from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/chrome-web-store/store-screenshots-v2"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1280, 800
BG = Path("/Users/zhizhi/.codex/generated_images/019ff3e2-1feb-7e80-b128-c3812b17e3d8/exec-e344a7c8-eebf-4a31-8c2e-e0ccb2d0e6b0.png")
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_B = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_I = "/System/Library/Fonts/Supplemental/Arial Italic.ttf"

def f(size, bold=False, italic=False):
    return ImageFont.truetype(FONT_I if italic else FONT_B if bold else FONT, size)

def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0]-1, size[1]-1), radius, fill=255)
    return m

def fit_crop(im, box):
    x, y, w, h = box
    scale = max(w / im.width, h / im.height)
    r = im.resize((round(im.width*scale), round(im.height*scale)), Image.Resampling.LANCZOS)
    left, top = (r.width-w)//2, (r.height-h)//2
    return r.crop((left, top, left+w, top+h))

def plate():
    if BG.exists():
        bg = fit_crop(Image.open(BG).convert("RGB"), (0, 0, W, H))
        # Keep the generated texture quiet behind the product UI.
        overlay = Image.new("RGBA", (W, H), (255, 250, 243, 180))
        bg = Image.alpha_composite(bg.convert("RGBA"), overlay)
    else:
        bg = Image.new("RGBA", (W, H), (250, 246, 239, 255))
    d = ImageDraw.Draw(bg)
    for x in range(0, W, 80): d.line((x, 0, x, H), fill=(80, 57, 38, 18), width=1)
    for y in range(0, H, 80): d.line((0, y, W, y), fill=(80, 57, 38, 18), width=1)
    return bg

def text(draw, xy, s, size, fill=(37, 31, 27), bold=False, italic=False):
    draw.text(xy, s, font=f(size, bold, italic), fill=fill)

def pill(draw, xy, s, fill=(255, 244, 233), stroke=(227, 104, 34), color=(113, 61, 30), size=18):
    x, y = xy
    bb = draw.textbbox((x, y), s, font=f(size, True))
    w, h = bb[2]-bb[0]+26, bb[3]-bb[1]+14
    draw.rounded_rectangle((x, y, x+w, y+h), h//2, fill=fill, outline=stroke, width=2)
    draw.text((x+13, y+7), s, font=f(size, True), fill=color)
    return w

def card(canvas, src, box, radius=20, border=(225, 216, 206)):
    x, y, w, h = box
    shadow = Image.new("RGBA", (w+24, h+24), (0,0,0,0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((12, 12, w+12, h+12), radius, fill=(60, 40, 26, 35))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    canvas.alpha_composite(shadow, (x-12, y-12))
    im = fit_crop(Image.open(src).convert("RGB"), (0, 0, w, h)).convert("RGBA")
    im.putalpha(rounded_mask((w, h), radius))
    canvas.alpha_composite(im, (x, y))
    ImageDraw.Draw(canvas).rounded_rectangle((x, y, x+w, y+h), radius, outline=border, width=2)

def browser_frame(canvas, src, box, url, crop=None):
    x, y, w, h = box
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle((x, y, x+w, y+h), 18, fill=(255, 253, 249), outline=(221, 210, 198), width=2)
    d.ellipse((x+18,y+16,x+28,y+26), fill=(229,100,52)); d.ellipse((x+36,y+16,x+46,y+26), fill=(236,174,72)); d.ellipse((x+54,y+16,x+64,y+26), fill=(111,157,91))
    d.rounded_rectangle((x+90,y+10,x+w-20,y+34), 12, fill=(247,243,237))
    text(d, (x+105,y+15), url, 13, fill=(126,115,105))
    inner = (x+14, y+46, w-28, h-60)
    if crop:
        im = fit_crop(Image.open(src).convert("RGB"), (0,0,inner[2],inner[3]))
    else:
        im = fit_crop(Image.open(src).convert("RGB"), (0,0,inner[2],inner[3]))
    im = im.convert("RGBA"); im.putalpha(rounded_mask((inner[2],inner[3]), 10)); canvas.alpha_composite(im, (inner[0], inner[1]))

def base_heading(canvas, kicker, headline, sub):
    d = ImageDraw.Draw(canvas)
    text(d, (68, 56), "AILatest Journal", 22, fill=(221, 88, 26), bold=True)
    text(d, (68, 108), headline, 34, fill=(36, 29, 24), bold=True)
    text(d, (70, 158), sub, 17, fill=(109, 94, 82))
    text(d, (70, 216), kicker.upper(), 14, fill=(221, 88, 26), bold=True)

def save(canvas, name):
    canvas.convert("RGB").save(OUT / name, quality=95)

def shot1():
    c=plate(); base_heading(c,"JOURNAL INSIGHTS WHERE YOU READ","See the signal","Journal ratings and indexes in one glance.")
    browser_frame(c, ROOT/"screenshots/preview.png", (520, 58, 690, 650), "journal.ailatest.org · journal finder")
    d=ImageDraw.Draw(c); pill(d,(72,278),"IF / JCR",size=17); pill(d,(72,330),"CAS zones",size=17); pill(d,(72,382),"SCIE · EI · Scopus",size=17); pill(d,(72,434),"Review time · OA",size=17)
    text(d,(72,540),"Less tab switching.",26,fill=(36,29,24),bold=True); text(d,(72,578),"More confident journal decisions.",22,fill=(109,94,82))
    save(c,"01-see-the-signal-1280x800.png")

def shot2():
    c=plate(); base_heading(c,"RATINGS AT A GLANCE","Compare what matters","A compact decision card for every journal.")
    browser_frame(c, ROOT/"screenshots/drawer.png", (450, 66, 750, 680), "journal.ailatest.org · journal details")
    d=ImageDraw.Draw(c); text(d,(76,290),"ONE CARD",14,fill=(221,88,26),bold=True); text(d,(76,322),"IF 7.6",42,fill=(221,88,26),bold=True); text(d,(76,378),"with index and quartile context",18,fill=(94,78,64))
    for i,s in enumerate(["SCIE","EI","Scopus","JCR Q1","CAS 1区 TOP","Review 5个月"]): pill(d,(70,440+i*42),s,size=15)
    save(c,"02-ratings-at-a-glance-1280x800.png")

def shot3():
    c=plate(); base_heading(c,"WORKS ACROSS DISCOVERY SITES","One extension, many research workflows","Bring the same journal context to the pages where you search and read.")
    d=ImageDraw.Draw(c)
    sites=[("Google Scholar",(72,300)),("PubMed",(72,370)),("CNKI",(72,440)),("Springer · IEEE · Elsevier",(72,510))]
    for s,(x,y) in sites:
        d.rounded_rectangle((x,y,x+315,y+46),23,fill=(255,253,249),outline=(224,211,196),width=2); d.ellipse((x+16,y+14,x+32,y+30),fill=(221,88,26)); text(d,(x+48,y+12),s,17,fill=(55,44,36),bold=True)
    browser_frame(c, ROOT/"screenshots/drawer.png", (450, 278, 350, 380), "scholar.google.com")
    browser_frame(c, ROOT/"screenshots/preview.png", (830, 278, 350, 380), "pubmed.ncbi.nlm.nih.gov")
    text(d,(450,688),"Supported sources are read in context — no separate lookup window.",16,fill=(109,94,82))
    save(c,"03-across-discovery-sites-1280x800.png")

def shot4():
    c=plate(); base_heading(c,"PERSONALIZE THE SIGNAL","Choose the badges you need","Show international indexes, Chinese rankings, ratings and access signals your way.")
    card(c, ROOT/"screenshots/chrome-web-store/01-language-and-theme-640x400.jpg", (70, 300, 535, 350), 18)
    card(c, ROOT/"screenshots/chrome-web-store/02-badge-settings-640x400.jpg", (675, 300, 535, 350), 18)
    d=ImageDraw.Draw(c); pill(d,(70,690),"Language",size=16); pill(d,(210,690),"Light / dark",size=16); pill(d,(390,690),"Index filters",size=16); pill(d,(560,690),"Badge settings",size=16)
    save(c,"04-personalize-the-signal-1280x800.png")

def shot5():
    c=plate(); base_heading(c,"FROM DISCOVERY TO DECISION","Keep the next step close","Find, shortlist and inspect journals without losing your research context.")
    card(c, ROOT/"screenshots/pick-results.png", (72, 286, 560, 390), 20)
    card(c, ROOT/"screenshots/drawer.png", (700, 286, 510, 390), 20)
    d=ImageDraw.Draw(c); text(d,(72,706),"Find a fit",18,fill=(221,88,26),bold=True); text(d,(700,706),"Check the evidence",18,fill=(221,88,26),bold=True)
    save(c,"05-from-discovery-to-decision-1280x800.png")

if __name__ == "__main__":
    shot1(); shot2(); shot3(); shot4(); shot5()
    print(f"saved {len(list(OUT.glob('*.png')))} screenshots to {OUT}")
