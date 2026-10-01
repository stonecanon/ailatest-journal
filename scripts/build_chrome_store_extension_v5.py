from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT=Path(__file__).resolve().parents[1]; SRC=ROOT/'assets/chrome-web-store/current-source-screens'; OUT=ROOT/'assets/chrome-web-store/extension-showcase-v5'; OUT.mkdir(parents=True,exist_ok=True)
W,H=1280,800; NAVY=(25,47,70); ORANGE=(239,91,30); CREAM=(255,252,247); INK=(38,34,30); MUTED=(111,99,89); LINE=(226,214,202); GREEN=(24,134,100)
EN='/System/Library/Fonts/Supplemental/Arial.ttf'; ENB='/System/Library/Fonts/Supplemental/Arial Bold.ttf'; CN='/System/Library/Fonts/Hiragino Sans GB.ttc'
def F(n,b=False,cn=False): return ImageFont.truetype(CN if cn else (ENB if b else EN),n,index=0) if cn else ImageFont.truetype(ENB if b else EN,n)
def T(d,x,y,s,n,fill=INK,b=False,cn=False): d.text((x,y),s,font=F(n,b,cn),fill=fill)
def R(d,b,r=16,fill=CREAM,outline=LINE,w=2): d.rounded_rectangle(b,r,fill=fill,outline=outline,width=w)
def canvas(title,sub,eyebrow):
 c=Image.new('RGBA',(W,H),CREAM+(255,)); d=ImageDraw.Draw(c); d.rectangle((0,0,W,104),fill=NAVY+(255,)); d.rectangle((0,0,12,H),fill=ORANGE+(255,));
 T(d,58,32,'AILatest Journal · Chrome extension',21,(255,255,255),True); T(d,62,154,title,42,INK,True,True); T(d,64,216,sub,18,MUTED,False,True); T(d,64,266,eyebrow.upper(),13,ORANGE,True); return c
def pill(d,x,y,s,color=ORANGE,fill=(255,241,232)):
 cn=any(ord(ch)>127 for ch in s); bb=d.textbbox((0,0),s,font=F(15,True,cn)); w=bb[2]+24; h=bb[3]-bb[1]+12; R(d,(x,y,x+w,y+h),h//2,fill,color,2); T(d,x+12,y+5,s,15,color,True,cn); return w
def card(d,b): R(d,b,20,(255,255,253),(224,213,202),2)
def result_row(d,x,y,title,source,offset=0):
 T(d,x,y,title,17,INK,True); T(d,x,y+28,source,13,MUTED); pill(d,x,y+55,'SCIE',(27,61,97),(235,243,250)); pill(d,x+70,y+55,'JCR Q1',ORANGE,(255,239,231)); pill(d,x+154,y+55,'IF 7.6',GREEN,(232,247,240)); d.line((x,y+103,x+560,y+103),fill=LINE,width=1)
def s1():
 c=canvas('搜索结果显示徽章','插件识别期刊名称，并在原页面旁边显示关键徽章。','01 · IN-PAGE BADGES'); d=ImageDraw.Draw(c); card(d,(520,132,1175,685)); T(d,552,160,'Google Scholar',14,MUTED,True); R(d,(552,192,1128,236),10,(247,243,237),LINE,1); T(d,570,204,'law and finance',16,INK); result_row(d,570,274,'Journal of Finance','JOURNAL ARTICLE · 2024'); result_row(d,570,408,'Journal of Financial Economics','JOURNAL ARTICLE · 2023'); result_row(d,570,542,'Research Policy','JOURNAL ARTICLE · 2022'); T(d,64,350,'识别',25,NAVY,True,True); T(d,64,394,'期刊名称',18,MUTED,False,True); T(d,64,480,'显示',25,NAVY,True,True); T(d,64,524,'索引、分区、IF',18,MUTED,False,True); c.convert('RGB').save(OUT/'01-in-page-badges-1280x800.png',quality=95)
def s2():
 c=canvas('覆盖常用科研网站','在检索结果、文章页面和期刊官网中工作。','02 · SUPPORTED SITES'); d=ImageDraw.Draw(c); sites=[('Google Scholar','搜索结果与文章列表'),('PubMed','文章页与期刊信息'),('CNKI','知网页面'),('Springer / IEEE / Elsevier','期刊官网与文章页'),('Web of Science / Scopus','索引检索页面'),('arXiv / Semantic Scholar','预印本与学术搜索')]
 for i,(a,b) in enumerate(sites): x=70+(i%2)*600; y=330+(i//2)*125; card(d,(x,y,x+535,y+92)); d.ellipse((x+24,y+29,x+48,y+53),fill=ORANGE); T(d,x+70,y+20,a,18,INK,True); T(d,x+70,y+52,b,14,MUTED,False,True)
 T(d,70,700,'插件会把期刊信息放回你正在阅读的页面。',17,NAVY,True,True); c.convert('RGB').save(OUT/'02-supported-sites-1280x800.png',quality=95)
def s3():
 c=canvas('插件设置，自定义显示','语言、主题、索引、分区、IF、免费发表和预警信息都可以单独控制。','03 · PERSONAL SETTINGS'); d=ImageDraw.Draw(c); im=Image.open(SRC/'popup-current.png').convert('RGB'); im=im.resize((360,650),Image.Resampling.LANCZOS); c.alpha_composite(im.convert('RGBA'),(120,116)); R(d,(560,154,1120,628),22,(255,255,253),LINE,2); T(d,610,198,'你可以选择',26,INK,True,True); opts=['语言：中文 / English','主题：网站默认 / 淡雅 / 深色','国际索引与国内目录','JCR / CAS / IF / CCF','免费发表 / 预警信息'];
 for i,s in enumerate(opts): y=270+i*60; d.ellipse((614,y+3,634,y+23),fill=ORANGE); T(d,660,y,s,17,INK,False,True)
 T(d,610,584,'设置保存在插件中，刷新页面即可生效。',15,MUTED,False,True); c.convert('RGB').save(OUT/'03-personal-settings-1280x800.png',quality=95)
def s4():
 c=canvas('登录同步账号权益','插件支持邮箱验证码、GitHub、Google 登录。','04 · SIGN IN & SYNC'); d=ImageDraw.Draw(c); R(d,(540,150,1135,640),24,(255,253,249),LINE,2); T(d,590,190,'AILatest Journal',20,NAVY,True); T(d,590,238,'注册 / 登录',28,INK,True,True); T(d,590,292,'未登录也可使用；登录后同步账号权益。',15,MUTED,False,True); T(d,590,348,'邮箱',13,MUTED); R(d,(590,374,1085,422),10,(255,255,253),(225,205,184),2); T(d,610,389,'you@example.com',16,MUTED); R(d,(590,452,1085,502),10,ORANGE,ORANGE,0); T(d,770,466,'注册 / 登录',16,(255,255,255),True,True); pill(d,590,540,'GitHub',NAVY,(239,244,249)); pill(d,690,540,'Google',GREEN,(232,247,240)); T(d,70,382,'一次登录',26,NAVY,True,True); T(d,70,430,'多台设备',26,NAVY,True,True); T(d,70,494,'同步收藏、投稿经验和打分记录。',16,MUTED,False,True); c.convert('RGB').save(OUT/'04-sign-in-sync-1280x800.png',quality=95)
def s5():
 c=canvas('从识别期刊，到决定投稿','插件负责把判断所需的信息，放在你正在阅读的位置。','05 · RESEARCH FLOW'); d=ImageDraw.Draw(c); steps=[('01','打开学术页面','Google Scholar / PubMed'),('02','识别期刊','Index · JCR · CAS · IF'),('03','继续比较','收藏并同步记录')]
 for i,(n,a,b) in enumerate(steps): x=70+i*390; card(d,(x,340,x+300,500)); T(d,x+28,370,n,15,ORANGE,True); T(d,x+28,414,a,22,NAVY,True,True); T(d,x+28,458,b,14,MUTED,False,True); 
 if True:
  T(d,392,410,'→',30,ORANGE,True); T(d,782,410,'→',30,ORANGE,True)
 T(d,70,600,'插件是阅读过程中的一层轻量信息提示，不改变原网站结构。',18,INK,True,True); c.convert('RGB').save(OUT/'05-research-flow-1280x800.png',quality=95)
if __name__=='__main__':
 for fn in (s1,s2,s3,s4,s5): fn()
 print('saved',len(list(OUT.glob('*.png'))),'extension showcase images to',OUT)
