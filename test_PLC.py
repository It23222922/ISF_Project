from pycomm3 import LogixDriver

PLC_IP = '192.168.10.9'

try:
    with LogixDriver(PLC_IP) as plc:
        print('✅ Connected to PLC!')
        print('PLC Info:', plc.info)
except Exception as e:
    print('❌ Connection failed:', e)