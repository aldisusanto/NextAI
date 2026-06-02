from PIL import Image, ImageDraw

def make_circle_mask(size):
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size[0], size[1]), fill=255)
    return mask

def make_rounded():
    img = Image.open('assets/logo_original.png').convert("RGBA")
    
    # Crop to square first if it's not
    width, height = img.size
    min_dim = min(width, height)
    left = (width - min_dim) / 2
    top = (height - min_dim) / 2
    right = (width + min_dim) / 2
    bottom = (height + min_dim) / 2
    img = img.crop((left, top, right, bottom))
    
    mask = make_circle_mask(img.size)
    
    # Create an empty image with transparent background
    output = Image.new('RGBA', img.size, (0, 0, 0, 0))
    output.paste(img, (0, 0), mask)
    
    # Save over the original
    output.save('assets/logo.png')
    print("Berhasil membuat logo menjadi bulat!")

make_rounded()
