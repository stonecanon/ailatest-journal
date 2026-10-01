from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'assets/chrome-web-store/current-source-screens'
OUT=ROOT/'assets/chrome-web-store/store-screenshots-current-v4'; OUT.mkdir(parents=True,exist_ok=True)
W,H=1280,800
BG=(251,247,240); BROWN=(55,40,31); ORANGE=(238,91,31); CREAM=(255,253,249); MUTED=(124,105,91); LINE=(226,214,202); GREEN=(26,133,100); NAVY=(28,61,97)
EN='/System/Library/Fonts/Supplemental/Arial.ttf'; ENB='/System/Library/Fonts/Supplemental/Arial Bold.ttf'; CN='/System/Library/Fonts/Hiragino Sans GB.ttc'
def font(n,b=False,cn=False): return ImageFont.truetype(CN if cn else (ENB if b else EN),n,index=0) if cn else ImageFont.truetype(ENB if b else EN,n)
def tx(d,xy,s,n,fill=BROWN,b=False,cn=False): d.text(xy,s,font=font(n,b,cn),fill=fill)
def rr(d,b,r=20,fill=CREAM,outline=LINE,w=2): d.rounded_rectangle(b,r,fill=fill,outline=outline,width=w)
def crop(src,box):
    x,y,w,h=box; im=Image.open(src).convert('RGB'); scale=max(w/im.width,h/im.height); im=im.resize((int(im.width*scale),int(im.height*scale)),Image.Resampling.LANCZOS); return im.crop(((im.width-w)//2,(im.height-h)//2,(im.width-w)//2+w,(im.height-h)//2+h))
def shot(canvas,src,box,r=20):
    x,y,w,h=box; sh=Image.new('RGBA',(w+30,h+30)); sd=ImageDraw.Draw(sh); sd.rounded_rectangle((15,15,w+15,h+15),r,fill=(40,25,12,50)); sh=sh.filter(ImageFilter.GaussianBlur(12)); canvas.alpha_composite(sh,(x-15,y-15)); im=crop(src,(0,0,w,h)).convert('RGBA'); mask=Image.new('L',(w,h)); ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),r,fill=255); im.putalpha(mask); canvas.alpha_composite(im,(x,y)); ImageDraw.Draw(canvas).rounded_rectangle((x,y,x+w,y+h),r,outline=(223,210,196),width=2)
def shot_img(canvas,im,box,r=20):
    x,y,w,h=box; im=im.convert('RGBA').resize((w,h),Image.Resampling.LANCZOS); mask=Image.new('L',(w,h)); ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),r,fill=255); im.putalpha(mask); canvas.alpha_composite(im,(x,y)); ImageDraw.Draw(canvas).rounded_rectangle((x,y,x+w,y+h),r,outline=(223,210,196),width=2)
def badge(d,x,y,s,fill=(255,241,232),color=ORANGE):
    use_cn=any(ord(ch)>127 for ch in s); bb=d.textbbox((0,0),s,font=font(15,True,use_cn)); w=bb[2]+24; h=bb[3]-bb[1]+12; rr(d,(x,y,x+w,y+h),h//2,fill,color,2); tx(d,(x+12,y+5),s,15,color,True,use_cn); return w
def base(left_title,left_sub,kicker,accent=ORANGE):
    c=Image.new('RGBA',(W,H),BG+(255,)); d=ImageDraw.Draw(c); d.rectangle((0,0,505,H),fill=BROWN+(255,)); d.rectangle((0,0,12,H),fill=accent+(255,));
    tx(d,(62,58),'AILatest Journal',20,(255,239,226),True); tx(d,(62,138),left_title,36,(255,255,255),True,True); tx(d,(64,220),left_sub,18,(241,226,213),False,True); tx(d,(64,292),kicker.upper(),13,accent,True); return c
def s1():
    c=base('把期刊看清楚','在检索结果里直接看到期刊评级、分区和影响因子。','FEATURES'); d=ImageDraw.Draw(c); shot(c,SRC/'home-current.png',(565,62,645,676),22); tx(d,(64,386),'不用来回切换网页',23,(255,255,255),True,True); tx(d,(64,432),'检索、比较、判断，放在同一条工作流里。',16,(241,226,213),False,True); badge(d,64,516,'IF / JCR'); badge(d,64,566,'CAS 分区',fill=(235,243,250),color=NAVY); badge(d,64,616,'SCIE / EI / Scopus',fill=(232,247,240),color=GREEN); c.convert('RGB').save(OUT/'01-current-overview-1280x800.png',quality=95)
def s2():
    c=base('你想看什么，自己决定','按语言、主题和徽章类型调整插件显示内容。','个性化设置'); d=ImageDraw.Draw(c); shot(c,SRC/'popup-current.png',(570,42,360,694),18); rr(d,(958,112,1165,566),20,CREAM,(235,220,204),2); tx(d,(988,148),'可个性化',24,BROWN,True,True); rows=['中文 / English','网站默认 / 淡雅 / 深色','国际索引与国内目录','JCR / CAS / IF / CCF','免费发表 / 预警信息'];
    for i,s in enumerate(rows): y=210+i*62; d.ellipse((990,y+2,1008,y+20),fill=ORANGE); tx(d,(1025,y),s,16,BROWN,False,True); c.convert('RGB').save(OUT/'02-current-settings-1280x800.png',quality=95)
def s3():
    c=base('登录同步收藏','邮箱验证码、GitHub 或 Google 登录。','ACCOUNT & SYNC'); d=ImageDraw.Draw(c); src=Image.open(SRC/'login-current.png').convert('RGB').crop((510,180,930,720)); shot_img(c,src,(565,82,640,570),22); tx(d,(64,390),'支持登录方式',22,(255,255,255),True,True); badge(d,64,458,'邮箱验证码',fill=(255,241,232),color=ORANGE); badge(d,64,510,'GitHub',fill=(239,244,249),color=NAVY); badge(d,64,562,'Google',fill=(232,247,240),color=GREEN); tx(d,(64,650),'登录后可同步收藏、投稿经验和打分记录。',15,(241,226,213),False,True); c.convert('RGB').save(OUT/'03-current-login-sync-1280x800.png',quality=95)
def s4():
    c=base('你常用的网站，都能接上','在学术检索、文章页面和期刊官网中识别期刊信息。','支持范围'); d=ImageDraw.Draw(c); sites=[('Google Scholar','检索结果页'),('PubMed','文章与期刊页'),('CNKI','知网页面'),('Springer · IEEE · Elsevier','期刊官网')];
    for i,(a,b) in enumerate(sites): x=570+(i%2)*315; y=160+(i//2)*210; rr(d,(x,y,x+285,y+142),18,CREAM,(235,220,204),2); d.ellipse((x+24,y+28,x+52,y+56),fill=ORANGE); tx(d,(x+72,y+24),a,18,BROWN,True); tx(d,(x+72,y+67),b,14,MUTED,False,True); tx(d,(x+72,y+101),'查看期刊徽章 →',14,ORANGE,True,True)
    tx(d,(64,400),'覆盖常用科研入口',25,(255,255,255),True,True); tx(d,(64,456),'同一套评级信息，跟着你阅读的位置出现。',16,(241,226,213),False,True); c.convert('RGB').save(OUT/'04-current-supported-sites-1280x800.png',quality=95)
def s5():
    c=base('从发现，到决定投稿','先找到候选期刊，再用清晰指标完成比较。','WORKFLOW'); d=ImageDraw.Draw(c); shot(c,SRC/'home-current.png',(555,80,370,510),20); shot(c,SRC/'popup-current.png',(970,80,230,510),18); tx(d,(575,632),'检索期刊',18,BROWN,True,True); tx(d,(990,632),'调整显示',18,BROWN,True,True); tx(d,(64,386),'一眼看到',25,(255,255,255),True,True); tx(d,(64,438),'索引、分区、IF、开放获取与预警。',16,(241,226,213),False,True); badge(d,64,538,'更快筛选投稿目标'); c.convert('RGB').save(OUT/'05-current-workflow-1280x800.png',quality=95)
if __name__=='__main__':
    for fn in (s1,s2,s3,s4,s5): fn()
    print('saved',len(list(OUT.glob('*.png'))),'current screenshots to',OUT)
