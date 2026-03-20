from flask import Flask, jsonify, request
from flask_cors import CORS
from pycomm3 import LogixDriver

app = Flask(__name__)
CORS(app)

PLC_IP = '192.168.10.9'

# ─────────────────────────────────────────
# Media Options (5 options)
# ─────────────────────────────────────────
MEDIA_MAP = {
    'Option 1': 1,
    'Option 2': 2,
    'Option 3': 3,
    'Option 4': 4,
    'Option 5': 5,
}

# ─────────────────────────────────────────
# Product Options (15 options)
# ─────────────────────────────────────────
PRODUCT_MAP = {
    'Option 1':  1,
    'Option 2':  2,
    'Option 3':  3,
    'Option 4':  4,
    'Option 5':  5,
    'Option 6':  6,
    'Option 7':  7,
    'Option 8':  8,
    'Option 9':  9,
    'Option 10': 10,
    'Option 11': 11,
    'Option 12': 12,
    'Option 13': 13,
    'Option 14': 14,
    'Option 15': 15,
}

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
# WRITE — Media and Product only (no QC)
# ─────────────────────────────────────────
@app.route('/api/set-line', methods=['POST'])
def set_line():
    data    = request.json
    line    = data.get('line')
    media   = data.get('media')
    product = data.get('product')

    if line not in PLC_TAGS:
        return jsonify({ 'status': 'error', 'message': f'Invalid line: {line}' }), 400

    media_val   = MEDIA_MAP.get(media)
    product_val = PRODUCT_MAP.get(product)

    if media_val is None or product_val is None:
        return jsonify({ 'status': 'error', 'message': 'Invalid option selected' }), 400

    tags = PLC_TAGS[line]

    try:
        with LogixDriver(PLC_IP) as plc:
            plc.write(tags['media'],   media_val)
            plc.write(tags['product'], product_val)
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
        with LogixDriver(PLC_IP) as plc:
            for line, values in data.items():
                if line not in PLC_TAGS:
                    continue
                tags        = PLC_TAGS[line]
                media_val   = MEDIA_MAP.get(values['media'])
                product_val = PRODUCT_MAP.get(values['product'])
                if None in (media_val, product_val):
                    return jsonify({ 'status': 'error', 'message': f'Invalid value in {line}' }), 400
                plc.write(tags['media'],   media_val)
                plc.write(tags['product'], product_val)
        return jsonify({ 'status': 'success', 'message': 'All lines written to PLC' })
    except Exception as e:
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


# ─────────────────────────────────────────
# READ — Get QC string values from PLC
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
        return jsonify({ 'status': 'success', 'qc': qc_state })
    except Exception as e:
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


# ─────────────────────────────────────────
# READ — Get current media and product from PLC
# (used by Screen 1 to display current values)
# ─────────────────────────────────────────
@app.route('/api/get-line-state', methods=['GET'])
def get_line_state():
    try:
        with LogixDriver(PLC_IP) as plc:
            line_state = {
                'L1': {
                    'media':   plc.read('L1_Media').value,
                    'product': plc.read('L1_Product').value,
                },
                'L2': {
                    'media':   plc.read('L2_Media').value,
                    'product': plc.read('L2_Product').value,
                },
                'L3': {
                    'media':   plc.read('L3_Media').value,
                    'product': plc.read('L3_Product').value,
                },
                'L4': {
                    'media':   plc.read('L4_Media').value,
                    'product': plc.read('L4_Product').value,
                },
            }
        return jsonify({ 'status': 'success', 'lines': line_state })
    except Exception as e:
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


# ─────────────────────────────────────────
# READ — L1 requests
# Also sets L1_Request_Active TRUE if any request pending
# ─────────────────────────────────────────
@app.route('/api/get-requests', methods=['GET'])
def get_requests():
    try:
        with LogixDriver(PLC_IP) as plc:
            media_trigger   = bool(plc.read('L1_Media_Trig').value)
            product_trigger = bool(plc.read('L1_Product_Trig').value)

            # Set output tag TRUE if either request is active
            if media_trigger or product_trigger:
                plc.write('L1_Request_Active', 1)

            requests = {
                'L1': {
                    'media':          media_trigger,
                    'product':        product_trigger,
                    'media_option':   'Option 1',
                    'product_option': None,
                }
            }
        return jsonify({ 'status': 'success', 'requests': requests })
    except Exception as e:
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


# ─────────────────────────────────────────
# WRITE — Reset L1 trigger after acknowledge
# Also sets L1_Request_Active FALSE
# ─────────────────────────────────────────
@app.route('/api/clear-request', methods=['POST'])
def clear_request():
    data = request.json
    kind = data.get('kind')

    tag_map = {
        'media':   'L1_Media_Trig',
        'product': 'L1_Product_Trig',
    }

    if kind not in tag_map:
        return jsonify({ 'status': 'error', 'message': 'Invalid kind' }), 400

    try:
        with LogixDriver(PLC_IP) as plc:
            plc.write(tag_map[kind], 0)

            # Only set FALSE if no other request is still active
            media_still   = bool(plc.read('L1_Media_Trig').value)
            product_still = bool(plc.read('L1_Product_Trig').value)
            if not media_still and not product_still:
                plc.write('L1_Request_Active', 0)

        return jsonify({ 'status': 'success' })
    except Exception as e:
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


# ─────────────────────────────────────────
# READ — Check stop requests from HMI
# Also sets L1_Stop_Active TRUE if any stop pending
# ─────────────────────────────────────────
@app.route('/api/get-stop-requests', methods=['GET'])
def get_stop_requests():
    try:
        with LogixDriver(PLC_IP) as plc:
            stop_product = bool(plc.read('Stop_Product_Trig').value)
            stop_option  = bool(plc.read('Stop_Option_Trig').value)

            # Set output tag TRUE if either stop is active
            if stop_product or stop_option:
                plc.write('L1_Stop_Active', 1)

            stop_state = {
                'stop_product': stop_product,
                'stop_option':  stop_option,
            }
        return jsonify({ 'status': 'success', 'stops': stop_state })
    except Exception as e:
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


# ─────────────────────────────────────────
# WRITE — Operator stops operation (commented out — not in use)
# ─────────────────────────────────────────
# @app.route('/api/stop-operation', methods=['POST'])
# def stop_operation():
#     data = request.json
#     kind = data.get('kind')
#     valve_map = {
#         'product': 'Stop_Product_Valve',
#         'option':  'Stop_Option1_Valve',
#     }
#     trigger_map = {
#         'product': 'Stop_Product_Trig',
#         'option':  'Stop_Option_Trig',
#     }
#     if kind not in valve_map:
#         return jsonify({ 'status': 'error', 'message': 'Invalid kind' }), 400
#     try:
#         with LogixDriver(PLC_IP) as plc:
#             plc.write(valve_map[kind],   1)
#             plc.write(trigger_map[kind], 0)
#         return jsonify({ 'status': 'success' })
#     except Exception as e:
#         return jsonify({ 'status': 'error', 'message': str(e) }), 500


# ─────────────────────────────────────────
# WRITE — Operator starts operation back (commented out — not in use)
# ─────────────────────────────────────────
# @app.route('/api/start-operation', methods=['POST'])
# def start_operation():
#     data = request.json
#     kind = data.get('kind')
#     valve_map = {
#         'product': 'Stop_Product_Valve',
#         'option':  'Stop_Option1_Valve',
#     }
#     if kind not in valve_map:
#         return jsonify({ 'status': 'error', 'message': 'Invalid kind' }), 400
#     try:
#         with LogixDriver(PLC_IP) as plc:
#             plc.write(valve_map[kind], 0)
#         return jsonify({ 'status': 'success' })
#     except Exception as e:
#         return jsonify({ 'status': 'error', 'message': str(e) }), 500


# ─────────────────────────────────────────
# READ — Check if stop valves are active
# (used by Screen 1 to show orange underglow)
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
# WRITE — Reset stop trigger after acknowledge
# Also sets L1_Stop_Active FALSE if none pending
# ─────────────────────────────────────────
@app.route('/api/clear-stop-request', methods=['POST'])
def clear_stop_request():
    data = request.json
    kind = data.get('kind')

    tag_map = {
        'product': 'Stop_Product_Trig',
        'option':  'Stop_Option_Trig',
    }

    if kind not in tag_map:
        return jsonify({ 'status': 'error', 'message': 'Invalid kind' }), 400

    try:
        with LogixDriver(PLC_IP) as plc:
            plc.write(tag_map[kind], 0)

            # Only set FALSE if no other stop is still active
            product_still = bool(plc.read('Stop_Product_Trig').value)
            option_still  = bool(plc.read('Stop_Option_Trig').value)
            if not product_still and not option_still:
                plc.write('L1_Stop_Active', 0)

        return jsonify({ 'status': 'success' })
    except Exception as e:
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)  # ← allows network access