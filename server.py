from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from pycomm3 import LogixDriver
from datetime import datetime

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────
# MySQL Database setup
# ─────────────────────────────────────────
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:1234@localhost/factory_log'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

PLC_IP = '192.168.10.9'

# ─────────────────────────────────────────
# Event Log Model
# ─────────────────────────────────────────
class EventLog(db.Model):
    __tablename__ = 'event_logs'
    id        = db.Column(db.Integer,     primary_key=True, autoincrement=True)
    timestamp = db.Column(db.DateTime,    default=datetime.now)
    line      = db.Column(db.String(4),   nullable=False)
    event     = db.Column(db.String(50),  nullable=False)
    details   = db.Column(db.String(200), nullable=True)


# ─────────────────────────────────────────
# Media/Product Option Models
# ─────────────────────────────────────────
class MediaOption(db.Model):
    __tablename__ = 'Media'
    id         = db.Column(db.Integer, primary_key=True, autoincrement=True)
    Media_name = db.Column(db.String(200), nullable=False)


class ProductOption(db.Model):
    __tablename__ = 'Product'
    id           = db.Column(db.Integer, primary_key=True, autoincrement=True)
    Product_name = db.Column(db.String(200), nullable=False)

# Create tables on startup
with app.app_context():
    db.create_all()

# ─────────────────────────────────────────
# Options map helpers (DB driven)
# ─────────────────────────────────────────
def load_option_maps():
    media_rows = MediaOption.query.order_by(MediaOption.id).all()
    product_rows = ProductOption.query.order_by(ProductOption.id).all()
    media_map = {row.Media_name: row.id for row in media_rows}
    product_map = {row.Product_name: row.id for row in product_rows}
    media_reverse = {row.id: row.Media_name for row in media_rows}
    product_reverse = {row.id: row.Product_name for row in product_rows}
    return media_map, product_map, media_reverse, product_reverse

# ─────────────────────────────────────────
# PLC Tags per Line
# ─────────────────────────────────────────
PLC_TAGS = {
    'L1': { 'media': 'L1_Media', 'product': 'L1_Product', 'qc': 'L1_QC' },
    'L2': { 'media': 'L2_Media', 'product': 'L2_Product', 'qc': 'L2_QC' },
    'L3': { 'media': 'L3_Media', 'product': 'L3_Product', 'qc': 'L3_QC' },
    'L4': { 'media': 'L4_Media', 'product': 'L4_Product', 'qc': 'L4_QC' },
}

# ─────────────────────────────────────────
# Request/Stop Tags per Line
# ─────────────────────────────────────────
REQUEST_TAGS = {
    'L1': { 'media_trig': 'L1_Media_Trig', 'product_trig': 'L1_Product_Trig', 'active': 'L1_Request_Active' },
    'L2': { 'media_trig': 'L2_Media_Trig', 'product_trig': 'L2_Product_Trig', 'active': 'L2_Request_Active' },
    'L3': { 'media_trig': 'L3_Media_Trig', 'product_trig': 'L3_Product_Trig', 'active': 'L3_Request_Active' },
    'L4': { 'media_trig': 'L4_Media_Trig', 'product_trig': 'L4_Product_Trig', 'active': 'L4_Request_Active' },
}

STOP_TAGS = {
    'L1': { 'product_trig': 'L1_Stop_Product_Trig', 'media_trig': 'L1_Stop_Media_Trig', 'active': 'L1_Stop_Active' },
    'L2': { 'product_trig': 'L2_Stop_Product_Trig', 'media_trig': 'L2_Stop_Media_Trig', 'active': 'L2_Stop_Active' },
    'L3': { 'product_trig': 'L3_Stop_Product_Trig', 'media_trig': 'L3_Stop_Media_Trig', 'active': 'L3_Stop_Active' },
    'L4': { 'product_trig': 'L4_Stop_Product_Trig', 'media_trig': 'L4_Stop_Media_Trig', 'active': 'L4_Stop_Active' },
}

# ─────────────────────────────────────────
# Track active requests to avoid duplicate logs
# ─────────────────────────────────────────
active_requests = {
    'L1': { 'media': False, 'product': False },
    'L2': { 'media': False, 'product': False },
    'L3': { 'media': False, 'product': False },
    'L4': { 'media': False, 'product': False },
}

active_stops = {
    'L1': { 'product': False, 'media': False },
    'L2': { 'product': False, 'media': False },
    'L3': { 'product': False, 'media': False },
    'L4': { 'product': False, 'media': False },
}

# ─────────────────────────────────────────
# Track QC state to avoid duplicate logs
# ─────────────────────────────────────────
qc_state_tracker = {
    'L1': None,
    'L2': None,
    'L3': None,
    'L4': None,
}


# ─────────────────────────────────────────
# WRITE — Media and Product only (no QC)
# Logs operator dropdown changes
# ─────────────────────────────────────────
@app.route('/api/set-line', methods=['POST'])
def set_line():
    data    = request.json
    line    = data.get('line')
    media   = data.get('media')
    product = data.get('product')

    if line not in PLC_TAGS:
        return jsonify({ 'status': 'error', 'message': f'Invalid line: {line}' }), 400

    media_map, product_map, media_reverse, product_reverse = load_option_maps()
    media_val   = media_map.get(media)
    product_val = product_map.get(product)

    if media_val is None or product_val is None:
        return jsonify({ 'status': 'error', 'message': 'Invalid option selected' }), 400

    tags = PLC_TAGS[line]

    try:
        with LogixDriver(PLC_IP) as plc:
            old_media   = plc.read(tags['media']).value
            old_product = plc.read(tags['product']).value
            plc.write(tags['media'],   media_val)
            plc.write(tags['product'], product_val)

        # ── Log changes only if values changed ──
        if old_media != media_val:
            db.session.add(EventLog(
                line    = line,
                event   = 'change_media',
                details = f"{media_reverse.get(old_media, old_media)} → {media}"
            ))
        if old_product != product_val:
            db.session.add(EventLog(
                line    = line,
                event   = 'change_product',
                details = f"{product_reverse.get(old_product, old_product)} → {product}"
            ))
        db.session.commit()

        return jsonify({
            'status':  'success',
            'line':    line,
            'written': {
                tags['media']:   media_val,
                tags['product']: product_val,
            }
        })
    except Exception as e:
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


# ─────────────────────────────────────────
# WRITE — All lines Media and Product only
# ─────────────────────────────────────────
@app.route('/api/set-all', methods=['POST'])
def set_all():
    data = request.json
    try:
        media_map, product_map, _, _ = load_option_maps()
        with LogixDriver(PLC_IP) as plc:
            for line, values in data.items():
                if line not in PLC_TAGS:
                    continue
                tags        = PLC_TAGS[line]
                media_val   = media_map.get(values['media'])
                product_val = product_map.get(values['product'])
                if None in (media_val, product_val):
                    return jsonify({ 'status': 'error', 'message': f'Invalid value in {line}' }), 400
                plc.write(tags['media'],   media_val)
                plc.write(tags['product'], product_val)
        return jsonify({ 'status': 'success', 'message': 'All lines written to PLC' })
    except Exception as e:
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


# ─────────────────────────────────────────
# READ — Media and Product options from DB
# ─────────────────────────────────────────
@app.route('/api/options', methods=['GET'])
def get_options():
    try:
        media_rows = MediaOption.query.order_by(MediaOption.id).all()
        product_rows = ProductOption.query.order_by(ProductOption.id).all()
        return jsonify({
            'status': 'success',
            'media': [
                { 'id': row.id, 'name': row.Media_name }
                for row in media_rows
            ],
            'product': [
                { 'id': row.id, 'name': row.Product_name }
                for row in product_rows
            ],
        })
    except Exception as e:
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


# ─────────────────────────────────────────
# READ — Get QC string values from PLC
# Logs QC changes
# ─────────────────────────────────────────
@app.route('/api/get-qc', methods=['GET'])
def get_qc():
    try:
        with LogixDriver(PLC_IP) as plc:
            qc_state = {
                'L1': plc.read('L1_QC').value,
                'L2': plc.read('L2_QC').value,
                'L3': plc.read('L3_QC').value,
                'L4': plc.read('L4_QC').value,
            }

        # ── Log QC changes only when value changes ──
        for line, value in qc_state.items():
            if value != qc_state_tracker[line]:
                if qc_state_tracker[line] is not None:  # skip first read on startup
                    db.session.add(EventLog(
                        line    = line,
                        event   = 'qc_change',
                        details = f"{qc_state_tracker[line]} → {value}"
                    ))
                    db.session.commit()
                qc_state_tracker[line] = value

        return jsonify({ 'status': 'success', 'qc': qc_state })
    except Exception as e:
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


# ─────────────────────────────────────────
# READ — Get current media and product from PLC
# ─────────────────────────────────────────
@app.route('/api/get-line-state', methods=['GET'])
def get_line_state():
    try:
        with LogixDriver(PLC_IP) as plc:
            line_state = {
                'L1': { 'media': plc.read('L1_Media').value, 'product': plc.read('L1_Product').value },
                'L2': { 'media': plc.read('L2_Media').value, 'product': plc.read('L2_Product').value },
                'L3': { 'media': plc.read('L3_Media').value, 'product': plc.read('L3_Product').value },
                'L4': { 'media': plc.read('L4_Media').value, 'product': plc.read('L4_Product').value },
            }
        return jsonify({ 'status': 'success', 'lines': line_state })
    except Exception as e:
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


# ─────────────────────────────────────────
# READ — All lines requests
# Logs new requests, sets LX_Request_Active
# ─────────────────────────────────────────
@app.route('/api/get-requests', methods=['GET'])
def get_requests():
    try:
        with LogixDriver(PLC_IP) as plc:
            result = {}
            for line, tags in REQUEST_TAGS.items():
                media_trigger   = bool(plc.read(tags['media_trig']).value)
                product_trigger = bool(plc.read(tags['product_trig']).value)

                if media_trigger or product_trigger:
                    plc.write(tags['active'], 1)

                # ── Log new media request (only on rising edge) ──
                if media_trigger and not active_requests[line]['media']:
                    db.session.add(EventLog(
                        line    = line,
                        event   = 'request_media',
                        details = 'Option 1 requested from HMI'
                    ))
                    db.session.commit()
                active_requests[line]['media'] = media_trigger

                # ── Log new product request (only on rising edge) ──
                if product_trigger and not active_requests[line]['product']:
                    db.session.add(EventLog(
                        line    = line,
                        event   = 'request_product',
                        details = 'Product change requested from HMI'
                    ))
                    db.session.commit()
                active_requests[line]['product'] = product_trigger

                result[line] = {
                    'media':          media_trigger,
                    'product':        product_trigger,
                    'media_option':   'Option 1',
                    'product_option': None,
                }
        return jsonify({ 'status': 'success', 'requests': result })
    except Exception as e:
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


# ─────────────────────────────────────────
# WRITE — Reset trigger after acknowledge
# Logs acknowledge, sets LX_Request_Active FALSE
# ─────────────────────────────────────────
@app.route('/api/clear-request', methods=['POST'])
def clear_request():
    data = request.json
    kind = data.get('kind')
    line = data.get('line')

    if line not in REQUEST_TAGS:
        return jsonify({ 'status': 'error', 'message': f'Invalid line: {line}' }), 400

    tags = REQUEST_TAGS[line]
    tag_map = {
        'media':   tags['media_trig'],
        'product': tags['product_trig'],
    }

    if kind not in tag_map:
        return jsonify({ 'status': 'error', 'message': 'Invalid kind' }), 400

    try:
        with LogixDriver(PLC_IP) as plc:
            plc.write(tag_map[kind], 0)
            media_still   = bool(plc.read(tags['media_trig']).value)
            product_still = bool(plc.read(tags['product_trig']).value)
            if not media_still and not product_still:
                plc.write(tags['active'], 0)

        # ── Log acknowledge ──
        db.session.add(EventLog(
            line    = line,
            event   = f'ack_{kind}',
            details = f'{kind.capitalize()} request acknowledged by operator'
        ))
        db.session.commit()

        return jsonify({ 'status': 'success' })
    except Exception as e:
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


# ─────────────────────────────────────────
# READ — All lines stop requests
# Logs new stop requests, sets LX_Stop_Active
# ─────────────────────────────────────────
@app.route('/api/get-stop-requests', methods=['GET'])
def get_stop_requests():
    try:
        with LogixDriver(PLC_IP) as plc:
            result = {}
            for line, tags in STOP_TAGS.items():
                stop_product = bool(plc.read(tags['product_trig']).value)
                stop_media   = bool(plc.read(tags['media_trig']).value)

                if stop_product or stop_media:
                    plc.write(tags['active'], 1)

                # ── Log new stop product request (rising edge) ──
                if stop_product and not active_stops[line]['product']:
                    db.session.add(EventLog(
                        line    = line,
                        event   = 'stop_product',
                        details = 'Product stop requested from HMI'
                    ))
                    db.session.commit()
                active_stops[line]['product'] = stop_product

                # ── Log new stop media request (rising edge) ──
                if stop_media and not active_stops[line]['media']:
                    db.session.add(EventLog(
                        line    = line,
                        event   = 'stop_media',
                        details = 'Media stop requested from HMI'
                    ))
                    db.session.commit()
                active_stops[line]['media'] = stop_media

                result[line] = {
                    'stop_product': stop_product,
                    'stop_media':   stop_media,
                }
        return jsonify({ 'status': 'success', 'stops': result })
    except Exception as e:
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


# ─────────────────────────────────────────
# WRITE — Reset stop trigger after acknowledge
# Logs stop acknowledge, sets LX_Stop_Active FALSE
# ─────────────────────────────────────────
@app.route('/api/clear-stop-request', methods=['POST'])
def clear_stop_request():
    data = request.json
    kind = data.get('kind')
    line = data.get('line')

    if line not in STOP_TAGS:
        return jsonify({ 'status': 'error', 'message': f'Invalid line: {line}' }), 400

    tags = STOP_TAGS[line]
    tag_map = {
        'product': tags['product_trig'],
        'media':   tags['media_trig'],
    }

    if kind not in tag_map:
        return jsonify({ 'status': 'error', 'message': 'Invalid kind' }), 400

    try:
        with LogixDriver(PLC_IP) as plc:
            plc.write(tag_map[kind], 0)
            product_still = bool(plc.read(tags['product_trig']).value)
            media_still   = bool(plc.read(tags['media_trig']).value)
            if not product_still and not media_still:
                plc.write(tags['active'], 0)

        # ── Log stop acknowledge ──
        db.session.add(EventLog(
            line    = line,
            event   = f'ack_stop_{kind}',
            details = f'Stop {kind} acknowledged by operator'
        ))
        db.session.commit()

        return jsonify({ 'status': 'success' })
    except Exception as e:
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


# ─────────────────────────────────────────
# READ — Check if stop valves are active
# ─────────────────────────────────────────
@app.route('/api/get-stop-state', methods=['GET'])
def get_stop_state():
    try:
        with LogixDriver(PLC_IP) as plc:
            stop_state = {
                'stop_product': bool(plc.read('Stop_Product_Valve').value),
                'stop_option':  bool(plc.read('Stop_Option1_Valve').value),
            }
        return jsonify({ 'status': 'success', 'stops': stop_state })
    except Exception as e:
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


# ─────────────────────────────────────────
# READ — Get event logs with optional filters
# ─────────────────────────────────────────
@app.route('/api/get-logs', methods=['GET'])
def get_logs():
    line  = request.args.get('line')
    event = request.args.get('event')
    limit = request.args.get('limit', 100, type=int)

    query = EventLog.query
    if line:
        query = query.filter_by(line=line)
    if event:
        query = query.filter_by(event=event)

    logs = query.order_by(EventLog.id.desc()).limit(limit).all()

    return jsonify({
        'status': 'success',
        'logs': [
            {
                'id':        l.id,
                'timestamp': l.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                'line':      l.line,
                'event':     l.event,
                'details':   l.details,
            }
            for l in logs
        ]
    })


# ─────────────────────────────────────────
# READ — Return client IP
# ─────────────────────────────────────────
@app.route('/api/get-client-ip', methods=['GET'])
def get_client_ip():
    ip = request.remote_addr
    return jsonify({ 'ip': ip })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)