from machine import I2C
import struct
def read_accel_x():
    i2c=I2C(0,freq=100000,sda=machine.Pin(4),scl=machine.Pin(5))
    i2c.writeto_mem(25,0x20,b'\0x97') # power up device and enable all axes
    i2c.writeto_mem(25,0x24,b'0x40') # turn on FIFO
    Lx=ord(i2c.readfrom_mem(25,0x28,1))
    Hx=ord(i2c.readfrom_mem(25,0x29,1))
    accel=struct.unpack('<h',bytearray([Lx,Hx]))[0]
    return accel
def read_accel_y():
    i2c=I2C(0,freq=100000,sda=machine.Pin(4),scl=machine.Pin(5))
    i2c.writeto_mem(25,0x20,b'\0x97') # power up device and enable all axes
    i2c.writeto_mem(25,0x24,b'0x40') # turn on FIFO
    Lx=ord(i2c.readfrom_mem(25,0x2a,1))
    Hx=ord(i2c.readfrom_mem(25,0x2b,1))
    accel=struct.unpack('<h',bytearray([Lx,Hx]))[0]
    return accel
def read_accel_z():
    i2c=I2C(0,freq=100000,sda=machine.Pin(4),scl=machine.Pin(5))
    i2c.writeto_mem(25,0x20,b'\0x97') # power up device and enable all axes
    i2c.writeto_mem(25,0x24,b'0x40') # turn on FIFO
    Lx=ord(i2c.readfrom_mem(25,0x2c,1))
    Hx=ord(i2c.readfrom_mem(25,0x2d,1))
    accel=struct.unpack('<h',bytearray([Lx,Hx]))[0]
    return accel

print(read_accel_x())
print(read_accel_y())
print(read_accel_z())