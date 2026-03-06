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
    data = request.json

    line    = data.get('line')       # 'L1', 'L2', 'L3', 'L4'
    media   = data.get('media')      # 'Option 1' ... 'Option 5'
    product = data.get('product')    # 'Option 1' ... 'Option 15'
    # ❌ QC removed from write — PLC controls it

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
            # ❌ No QC write — PLC handles it

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
                # ❌ QC removed from write — PLC controls it

                if None in (media_val, product_val):
                    return jsonify({ 'status': 'error', 'message': f'Invalid value in {line}' }), 400

                plc.write(tags['media'],   media_val)
                plc.write(tags['product'], product_val)
                # ❌ No QC write

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
                'L1': plc.read('L1_QC').value,  # reads 'Yes' or 'No'
                'L2': plc.read('L2_QC').value,
                'L3': plc.read('L3_QC').value,
                'L4': plc.read('L4_QC').value,
            }
        return jsonify({ 'status': 'success', 'qc': qc_state })

    except Exception as e:
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


if __name__ == '__main__':
    app.run(port=5000, debug=True)