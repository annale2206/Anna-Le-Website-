from pathlib import Path
from xml.sax.saxutils import escape
import re
from PIL import Image, ImageOps, ImageDraw
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader
import pypdfium2 as pdfium

ROOT=Path(__file__).resolve().parent
OUT=Path.cwd()/ 'output/pdf/The_Perfect_Face_Visual_Archive.pdf'
pdfmetrics.registerFont(TTFont('Georgia','C:/Windows/Fonts/georgia.ttf'))
pdfmetrics.registerFont(TTFont('GeorgiaBold','C:/Windows/Fonts/georgiab.ttf'))
pdfmetrics.registerFont(TTFont('Arial','C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold','C:/Windows/Fonts/arialbd.ttf'))
INK=HexColor('#253334'); GREEN=HexColor('#466660'); PAPER=HexColor('#FAF8F3'); ROSE=HexColor('#DDB7AE')
W,H=612,792; M=48; CW=W-2*M
styles={
 'body':ParagraphStyle('body',fontName='Arial',fontSize=11.2,leading=17,textColor=INK,spaceAfter=12),
 'caption':ParagraphStyle('caption',fontName='Arial',fontSize=11.5,leading=18,textColor=INK),
 'credit':ParagraphStyle('credit',fontName='Arial',fontSize=8.5,leading=12,textColor=GREEN),
 'large':ParagraphStyle('large',fontName='Georgia',fontSize=24,leading=32,textColor=INK),
 'title':ParagraphStyle('title',fontName='GeorgiaBold',fontSize=27,leading=33,textColor=INK),
 'small':ParagraphStyle('small',fontName='Arial',fontSize=9.5,leading=14,textColor=INK),
}

intro=[
'''A face in a beauty advertisement can look effortless, but the image teaches viewers how to evaluate a body. Smooth skin, an even complexion, and a youthful appearance can become signs of a desirable person. Pores, lines, and unevenness may instead appear as problems requiring correction. This archive asks: How do beauty advertisements define which human features should be visible, valued, or improved? Its eight examples examine the relationship between beauty, consumer identity, and the idea of a normal human face.''',
'''The archive begins with product advertising and moves toward campaigns that question beauty standards. Maybelline's foundation page combines a pore-blurring promise with a grid of skin shades. COVERGIRL's Simply Ageless banner offers products for mature skin while emphasizing youthfulness. L'Oreal's makeup tutorial makes a mature face visible through a side-by-side portrait. Clinique's banner presents improved skin as something available in a bottle. Together, these images frame the human as a consumer who can work on appearance through products and routines.''',
'''These examples also complicate a simple opposition between exclusion and inclusion. A shade range acknowledges that customers have different skin tones. A portrait of mature skin acknowledges that beauty is not limited to young faces. Yet both forms of inclusion can coexist with expectations of smoother or more perfected skin. The issue is therefore not only who appears in an advertisement. It is also what those people are asked to change in order to fit its ideal. Representation can expand while the pressure to improve remains.''',
'''Rosi Braidotti's introduction to The Posthuman offers one way to understand this tension. She questions the apparent universality of the familiar human subject and explains that this category has not represented everyone equally (Introduction, pp. 1-3). Applied to beauty advertising, her argument encourages us to examine the standard against which faces are measured. This is my application of her framework, rather than a claim that Braidotti specifically analyzes cosmetics. The archive asks whose bodily differences become acceptable and whose differences are framed as needing adjustment.''',
'''Braidotti's discussion of a nature-culture continuum also challenges the idea that a face and its representation belong to separate worlds. Cosmetics, cameras, lighting, websites, and digital editing participate in how faces become publicly visible. Maybelline's comparison slider makes the viewer an active evaluator of a before-and-after image. The body is presented through a designed encounter with technology and commercial language. This does not make the person less human. It shows that the appearance through which we recognize someone is shaped by material and cultural relationships.''',
'''Nicholas Mirzoeff's introduction to How to See the World provides a second course connection. He describes making and sharing images as ways people understand their world and their place within it. His discussion of digitally assembled imagery highlights the gap between a convincing appearance and its production (Introduction, pp. 6-10). In this archive, that distinction matters when reading Dove's Reverse Selfie comparison: the polished face can conceal the process of creating it. A critical viewer asks how the image was made and which features its construction changes.''',
'''The final examples offer alternatives to a single perfected face. Dove's group portrait emphasizes visible variety, while its Beauty in the AI Age campaign pairs faces with a promise of authenticity. These images challenge uniformity, but they are still selected, composed, branded representations. Their commercial setting deserves attention too. Overall, the archive argues that beauty advertising helps construct the human as both a person worthy of recognition and a project requiring improvement. Looking carefully allows us to question that expectation without judging individuals who enjoy makeup or self-expression.'''
]

items=[
('01-maybelline.jpg','01','Pores as a problem','Maybelline, Fit Me Matte + Poreless foundation product page',
 'https://www.maybelline.com/face-makeup/foundation-makeup/fit-me-matte-poreless-foundation',
 '''The bottle, liquid swatch, and shade grid give the face a commercial vocabulary: tone can be matched and texture can be improved. The promise of blurred pores places ordinary skin features within a problem-and-solution format. The shade grid recognizes varied complexions, yet the preferred finish remains smooth and even. This image belongs in the archive because inclusion across skin tones can coexist with a shared expectation of correction. Braidotti's critique of the universal human helps us question the appearance treated as the standard.''',
 'PRODUCT PROMISE / TEXTURE', (0,130,1250,710)),
('02-covergirl.jpg','02','Mature skin, youthful ideal','COVERGIRL, Simply Ageless collection banner',
 'https://www.covergirl.com/collection-makeup/simply-ageless',
 '''Large lettering and oversized bottles make agelessness the collection's visual identity. Its wording addresses mature skin while linking the desired outcome with a youthful appearance. Older consumers are acknowledged, but visible aging remains something to manage. The sky background and clean product arrangement make improvement look light and uncomplicated. This example helps ask what kind of human is imagined: a person allowed to age, or a consumer expected to make aging less visible? The caption analyzes the promotional framing, rather than claiming the products erase age.''',
 'PRODUCT PROMISE / AGE', (0,100,1250,710)),
('03-loreal.jpg','03','Making mature faces visible',"L'Oreal Paris, Your Easy Age Perfect Makeup Routine, header portrait",
 'https://www.lorealparisusa.com/beauty-magazine/makeup/makeup-looks/age-perfect-makeup-routine',
 '''The side-by-side portrait places a mature face at the center of makeup advice. Visible lines remain part of the image, and the right portrait emphasizes lipstick, blush, and a styled appearance. This offers a contrast to advertising that makes mature people absent altogether. At the same time, the arrangement invites comparison between two presentations of one face. Through Braidotti, we can ask how inclusion works: does the image broaden beauty, or make recognition depend on a polished result? The screenshot does not establish whether either portrait was digitally retouched.''',
 'REPRESENTATION / MATURITY', None),
('04-clinique.jpg','04','Improvement in a bottle','Clinique, Even Better makeup collection banner',
 'https://www.clinique.com/pages/even-better-makeup',
 '''A glossy sweep of makeup sits beside carefully arranged bottles. The face itself is absent, replaced by a promise of better skin and products presented with clinical authority. This absence matters: the viewer is invited to imagine their own face as the site needing improvement. The smooth surface makes an ideal finish visible while leaving ordinary skin variation outside the frame. The human appears here primarily as a potential consumer. This example shows how an image can define expectations for bodies even when it contains no person.''',
 'CONSUMPTION / AUTHORITY', None),
('05-maybelline-comparison.jpg','05','The face as a comparison','Maybelline, Fit Me before-and-after application slider',
 'https://www.maybelline.com/face-makeup/foundation-makeup/fit-me-matte-poreless-foundation',
 '''The dividing line makes one face into a visual test. Skin on the two sides appears different in shine and evenness, while the slider invites viewers to inspect and compare. Ordinary texture becomes the evidence against which the advertised finish is assessed. The framing turns a living face into a surface to evaluate. Mirzoeff's attention to constructed images helps us examine how the interface organizes looking. This is an application comparison presented by the brand; it is not evidence that a social media filter was used.''',
 'INTERFACE / COMPARISON', (90,0,1160,710)),
('06-dove-reverse.jpg','06','Showing digital distortion','Dove, Reverse Selfie campaign webpage, split-face graphic',
 'https://www.dove.com/au/stories/campaigns/confidence.html',
 '''The split-face graphic contrasts a less polished presentation with a visibly styled one. Unlike a product advertisement that celebrates an improved result, this campaign identifies digital distortion as something to question. The comparison encourages viewers to notice the distance between a face and a manufactured beauty image. It connects with Mirzoeff's distinction between what looks convincing and how an image is produced. However, the critique also builds Dove's commercial identity around confidence. Resistance to perfection becomes both a message and a form of branding.''',
 'COUNTERIMAGE / DISTORTION', (0,150,1250,710)),
('07-dove-pledge.jpg','07','A wider field of beauty','Dove, Real Beauty Pledge webpage, group portrait',
 'https://www.dove.com/us/en/campaigns/purpose/real-beauty-pledge.html',
 '''The group portrait presents varied skin tones, body sizes, hair, clothing, and visible ages within one composition. Shared laughter and physical closeness shift attention from an isolated face toward relationships between people. It challenges the idea that beauty has one universal form. Yet the white studio setting, styling, and arrangement remind us that authenticity is also represented through deliberate choices. Braidotti helps ask whether the image expands the human standard or questions the need for one. No single group portrait can stand for everyone.''',
 'COUNTERIMAGE / VARIETY', (165,280,1085,610)),
('08-dove-code.jpg','08','Authenticity in the AI age','Dove, Keep Beauty Real campaign, Beauty in the AI Age banner',
 'https://www.dove.com/us/en/campaigns/purpose/keep-beauty-real.html',
 '''The banner pairs two smiling faces with the language of keeping beauty real. Curly hair, proximity, and an outdoor setting make connection central to the image's appeal. The campaign positions human representation as something to protect in an age of synthetic imagery. Braidotti's nature-culture continuum complicates a simple real-versus-technological divide: this campaign is itself a designed digital representation. Its promise can still be meaningful, but viewers must examine how authenticity is framed and sold. The archive ends by questioning who gets to define a real face.''',
 'COUNTERIMAGE / AUTHENTICITY', (70,190,1248,610)),
]

reflection='''Building this archive changes the question from whether a face is beautiful to how an image teaches us to judge that face. The product pages make pores, unevenness, and aging visible mainly as things to improve. The counterimages show that variety and ordinary features can also become sources of recognition. I understand the human less as a fixed visual ideal and more as a person represented through relationships with products, cameras, interfaces, and cultural expectations. I also notice that broader representation does not automatically remove the pressure to change. A campaign can celebrate difference while continuing to sell a beauty ideal. The most useful shift is learning to ask what an image rewards, what it hides, and whose appearance it treats as normal.'''

c=canvas.Canvas(str(OUT),pagesize=(W,H))
c.setTitle('The Perfect Face: Beauty, Advertising, and the Human')
c.setAuthor('Visual archive draft')
page=0
def base(section):
 global page
 page+=1; c.setFillColor(PAPER); c.rect(0,0,W,H,fill=1,stroke=0)
 c.setFillColor(GREEN); c.setFont('ArialBold',8); c.drawString(M,H-30,'PROJECT 1 / UNMAKING HUMAN'); c.drawRightString(W-M,H-30,section.upper())
 c.setStrokeColor(ROSE); c.line(M,42,W-M,42); c.setFillColor(GREEN); c.setFont('Arial',8)
 c.drawString(M,28,'THE PERFECT FACE / VISUAL ARCHIVE'); c.drawRightString(W-M,28,f'{page:02d}')
def para(text,y,style='body',width=CW,x=M):
 p=Paragraph(text,styles[style]); _,h=p.wrap(width,700)
 assert y-h>=55,(page,y,h,text[:50])
 p.drawOn(c,x,y-h); return y-h
def title(text,sub=None):
 y=para(escape(text),H-70,'title')-12
 if sub:y=para(escape(sub),y,'small')-18
 return y
def picture(path,y,maxh):
 im=Image.open(path); iw,ih=im.size; scale=min(CW/iw,maxh/ih); dw,dh=iw*scale,ih*scale
 c.drawImage(str(path),M+(CW-dw)/2,y-dh,width=dw,height=dh)
 return y-dh

base('Visual essay')
c.setFillColor(ROSE); c.rect(M,440,CW,260,fill=1,stroke=0)
para('THE<br/>PERFECT FACE',665,'title',x=M+25,width=CW-50)
para('Beauty, Advertising,<br/>and the Human',570,'large',x=M+25,width=CW-50)
para('How do beauty advertisements define which human features should be visible, valued, or improved?',390,'large')
para('Eight visual examples / Product marketing, comparison interfaces, and campaigns questioning perfection',258,'body')
para('A visual essay draft for review. Personalize the final reflection before submitting.',150,'small')
c.showPage()
count=len(re.findall(r"\b[\w'-]+\b",' '.join(intro)))
assert 500<=count<=750,count
for group,label in [(intro[:4],'Introduction / 1 of 2'),(intro[4:],'Introduction / 2 of 2')]:
 base(label); y=title('Reading the perfect face',f'Introduction: {count} words total')
 for p in group:y=para(escape(p),y)-13
 c.showPage()

for filename,num,heading,credit,url,caption,tag,crop in items:
 base(f'Visual {num} / 08'); y=title(f'{num} / {heading}',tag)
 im=Image.open(ROOT/filename)
 if crop:im=im.crop(crop)
 processed=ROOT/('print-'+filename); im.save(processed,quality=95)
 y=picture(processed,y,340)-22
 y=para(escape(caption),y,'caption')-22
 y=para(escape(credit)+'. Screenshot, October 11, 2026.','credit' if False else y,'credit')-5
 para(f'<link href="{escape(url)}" color="#466660"><u>View original source</u></link>',y,'credit')
 c.showPage()

base('Final reflection'); y=title('What changed in how I understand "the human"?')
y=para('Sample reflection - revise this paragraph so it reflects your own observations and learning.',y,'small')-25
y=para(escape(reflection),y,'caption')-36
y=para('The archive in one sentence',y,'large')-15
para('Beauty advertising can recognize more kinds of people while still asking their faces to meet a shared ideal of improvement.',y,'caption')
c.showPage()

base('Sources'); y=title('Course readings & image credits')
y=para('<b>Course readings</b>',y,'body')-6
y=para('Braidotti, Rosi. <i>The Posthuman</i>. Polity, 2013. Introduction, pp. 1-3. Course PDF: BraidottiPosthumanIntroduction.pdf.',y,'small')-10
y=para('Mirzoeff, Nicholas. <i>How to See the World</i>. Pelican, 2015. Introduction, pp. 6-10. Course PDF: HowtoSeetheWorldIntroductionMirzoeff.pdf.',y,'small')-20
y=para('<b>Image sources</b>',y,'body')-4
for filename,num,heading,credit,url,caption,tag,crop in items:
 y=para(f'<b>{num}.</b> {escape(credit)}. <link href="{escape(url)}" color="#466660"><u>Original webpage</u></link>.',y,'small')-8
y=para('All web visuals were captured on October 11, 2026. Sources are credited to the publishing brands; individual photographers are not identified on the captured sections. Screenshots are cropped for layout. Product claims are analyzed as advertising language, not endorsed as factual outcomes.',y-5,'small')
c.showPage(); c.save()
doc=PdfReader(OUT); assert len(doc.pages)==13,len(doc.pages)
pdf=pdfium.PdfDocument(str(OUT)); thumbs=[]
for i in range(len(pdf)):
 img=pdf[i].render(scale=1.2).to_pil().convert('RGB'); img.save(ROOT/f'page-{i+1:02d}.png')
 thumb=ImageOps.contain(img,(306,396)); thumbs.append(thumb)
sheet=Image.new('RGB',(306*4,416*4),'#ddd'); draw=ImageDraw.Draw(sheet)
for i,im in enumerate(thumbs):sheet.paste(im,((i%4)*306,(i//4)*416)); draw.text(((i%4)*306+8,(i//4)*416+398),f'Page {i+1}',fill='black')
sheet.save(ROOT/'pdf-contact.png')
print(f'Created {OUT}; {len(doc.pages)} pages; introduction {count} words; 8 visual entries.')
