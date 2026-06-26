import struct

def parse_bmp(filename):
    with open(filename, 'rb') as f:
        header = f.read(54)
        if header[:2] != b'BM':
            print("Not a BMP file")
            return
        
        pixel_data_offset = struct.unpack('<I', header[10:14])[0]
        width = struct.unpack('<i', header[18:22])[0]
        height = struct.unpack('<i', header[22:26])[0]
        bpp = struct.unpack('<H', header[28:30])[0]
        
        f.seek(pixel_data_offset)
        row_size = ((width * bpp + 31) // 32) * 4
        rows = []
        for _ in range(abs(height)):
            rows.append(f.read(row_size))
            
        mid_row_idx = abs(height) // 2
        mid_row_data = rows[mid_row_idx]
        
        print("Middle row pixels (first 30):")
        for x in range(min(30, width)):
            if bpp == 24:
                idx = x * 3
                b = mid_row_data[idx]
                g = mid_row_data[idx+1]
                r = mid_row_data[idx+2]
                hex_color = f"#{r:02X}{g:02X}{b:02X}"
                print(f"x={x}: {hex_color}")
            elif bpp == 32:
                idx = x * 4
                b = mid_row_data[idx]
                g = mid_row_data[idx+1]
                r = mid_row_data[idx+2]
                a = mid_row_data[idx+3]
                hex_color = f"#{r:02X}{g:02X}{b:02X} (A={a})"
                print(f"x={x}: {hex_color}")

parse_bmp('skins/Headspace/progressbar_foreground.bmp')
