from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'assets/chrome-web-store/current-source-screens'
V5=ROOT/'assets/chrome-web-store/extension-showcase-v5'
OUT=ROOT/'assets/chrome-web-store/extension-simple-v6'; OUT.mkdir(parents=True,exist_ok=True)
W,H=1280,800; CREAM=(252,247,239); NAVY=(26,49,73); ORANGE=(239,91,30); INK=(40,32,27); WHITE=(255,255,255)
FONT='/Users/zhizhi/Library/Fonts/MicrosoftYaHei.ttf'; BOLD='/Users/zhizhi/Library/Fonts/MicrosoftYaHei-Bold-v11.3.ttc'
def ft(n,b=False): return ImageFont.truetype(BOLD if b else FONT,n,index=0)
def text(d,x,y,s,n,fill=INK,b=True): d.text((x,y),s,font=ft(n,b),fill=fill)
def fit(im,w,h):
    scale=min(w/im.width,h/im.height); r=im.resize((int(im.width*scale),int(im.height*scale)),Image.Resampling.LANCZOS); out=Image.new('RGB',(w,h),WHITE); out.paste(r,((w-r.width)//2,(h-r.height)//2)); return out
def frame(c,im,b):
    x,y,w,h=b; shadow=Image.new('RGBA',(w+28,h+28)); sd=ImageDraw.Draw(shadow); sd.rounded_rectangle((14,14,w+14,h+14),22,fill=(35,25,18,45)); shadow=shadow.filter(ImageFilter.GaussianBlur(12)); c.alpha_composite(shadow,(x-14,y-14)); r=fit(im,w,h).convert('RGBA'); mask=Image.new('L',(w,h)); ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),20,fill=255); r.putalpha(mask); c.alpha_composite(r,(x,y)); ImageDraw.Draw(c).rounded_rectangle((x,y,x+w,y+h),20,outline=(224,211,197),width=2)
def make(name,lines,im,accent=ORANGE):
    c=Image.new('RGBA',(W,H),CREAM+(255,)); d=ImageDraw.Draw(c); d.rectangle((0,0,W,14),fill=accent+(255,)); text(d,72,62,'AILatest Journal',22,ORANGE,True)
    yy=132
    for line in lines: text(d,72,yy,line,54,NAVY,True); yy+=70
    frame(c,im,(72,330,1136,360)); c.convert('RGB').save(OUT/name,quality=95)
def main():
    make('01-auto-journal-badges-1280x800.png',['自动显示','期刊评级徽章'],Image.open(V5/'01-in-page-badges-1280x800.png').crop((510,125,1180,695)))
    make('02-supported-academic-sites-1280x800.png',['支持常用的','学术网站'],Image.open(V5/'02-supported-sites-1280x800.png').crop((55,300,1210,710)))
    make('03-customize-badges-1280x800.png',['徽章显示内容','自由选择'],Image.open(SRC/'popup-current.png'))
    make('04-account-sync-1280x800.png',['登录一次','跨设备同步'],Image.open(V5/'04-sign-in-sync-1280x800.png').crop((530,140,1145,650)))
    make('05-in-page-information-1280x800.png',['在原页面直接看到','SCIE · JCR · CAS · IF'],Image.open(V5/'01-in-page-badges-1280x800.png').crop((510,125,1180,695)),NAVY)
    print('saved',len(list(OUT.glob('*.png'))),'simple images to',OUT)
if __name__=='__main__': main()
