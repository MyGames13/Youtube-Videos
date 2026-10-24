import sys
from PIL import Image, ImageDraw
files=sys.argv[2:]; out=sys.argv[1]
cols=3; w,h=640,360
rows=(len(files)+cols-1)//cols
S=Image.new('RGB',(cols*w,rows*h),'black')
for i,f in enumerate(files):
    im=Image.open(f).convert('RGB').resize((w,h))
    d=ImageDraw.Draw(im); d.text((8,8),f.split('_')[-1],fill='yellow')
    S.paste(im,((i%cols)*w,(i//cols)*h))
S.save(out)
