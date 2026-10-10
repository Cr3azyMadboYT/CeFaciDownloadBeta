"""Muzică originală pentru „Biletul de ieșit” (124 BPM, 28,5 măsuri). Totul e sintetizat aici: fără sample-uri, voci sau
melodii preluate. Structura urmează imaginea: intro tensionat cu întrebările, ridicare, drop pe „CeFaci.”, groove pe
pașii aplicației, pauză scurtă pe ruletă, final cu ultimul acord ținut."""
import pathlib,wave
import numpy as np
SR=48000;BPM=124;B=60/BPM;BAR=4*B;DUR=round(BAR*28.5,2)
mix=np.zeros((int(SR*DUR)+SR,2))
rng=np.random.default_rng(3124)
def add(at,s,amp=1,pan=0):
 i=int(at*SR);j=min(i+len(s),len(mix));s=s[:j-i]*amp
 if j<=i:return
 mix[i:j,0]+=s*np.sqrt((1-pan)/2);mix[i:j,1]+=s*np.sqrt((1+pan)/2)
def ts(sec):return np.arange(int(sec*SR))/SR
def kick(a=1):
 t=ts(.32);return np.sin(2*np.pi*(46*t+130*.04*(1-np.exp(-t/.04))))*np.exp(-t*12)*a
def noise(sec,dec,hp=True):
 t=ts(sec);n=rng.normal(0,1,len(t))
 if hp:n=np.concatenate(([0],np.diff(n)))
 return n*np.exp(-t*dec)
def clap():
 s=noise(.22,22);t=ts(.22);return s*(1+.6*np.sin(2*np.pi*1.2e3*t))
def saw(f,sec,dec=3,bright=8):
 t=ts(sec);v=sum(np.sin(2*np.pi*f*k*t)/k for k in range(1,bright));return v*np.exp(-t*dec)*np.minimum(t*200,1)
def pad(freqs,sec):
 t=ts(sec);v=sum(np.sin(2*np.pi*f*t+np.sin(2*np.pi*.3*t)*.4)+.3*np.sin(2*np.pi*f*2.003*t) for f in freqs)/len(freqs)
 env=np.minimum(t/.4,1)*np.minimum((sec-t)/.5,1);return v*env
# acorduri (Hz): Am – F – C – G, câte unul pe măsură
CH=[[220,261.63,329.63],[174.61,220,261.63],[261.63,329.63,392],[196,246.94,293.66]]
BASS=[55,43.65,65.41,49]
def bar_at(n):return n*BAR
for n in range(29):
 at=bar_at(n);ch=CH[n%4];bass=BASS[n%4]
 if n>=28.5:break
 intro=n<3;rise=n==3;breakdown=22<=n<24;last=n>=24
 if intro:
  add(at,pad(ch,BAR),.10)
  for b in range(4):add(at+b*B,kick(.35))
  for k in range(8):add(at+k*B/2,noise(.05,90),.03,(-1)**k*.4)  # ceasul care ticăie
 elif rise:
  add(at,pad(ch,BAR),.12)
  t=ts(BAR);sw=rng.normal(0,1,len(t));sw=np.convolve(sw,np.ones(6)/6,'same')*(t/BAR)**2;add(at,sw,.16)
  for k in range(16):add(at+k*B/4,clap()*.5,.06+.10*k/16)
 else:
  energy=.75 if breakdown else 1
  for b in range(4):
   if not breakdown or b%2==0:add(at+b*B,kick(.95*energy))
   if b%2==1:add(at+b*B,clap(),.20*energy)
   for h in range(2):add(at+b*B+h*B/2+B/4*(h==1),noise(.06,70),.05*energy,.35 if h else -.35)
   add(at+b*B+B/2,saw(bass*2,B*.45,6,5),.16*energy)
   add(at+b*B,saw(bass,B*.4,7,4),.18*energy)
  add(at,pad(ch,BAR),.09)
  for k,iv in enumerate([0,2,1,2,0,2,1,2]):  # arpegiu
   add(at+k*B/2,saw(ch[iv]*2,B*.4,9,6),.035*energy,.3 if k%2 else -.3)
# drop: o lovitură mare pe „CeFaci.”
add(bar_at(4),kick(1.3));add(bar_at(4),noise(1.2,3,False)*.5,.12)
# apăsările de pe ecran (clic) în pașii cu întrebări și ștampilele (bufnitură)
for k in range(5):add(bar_at(7+k)+B*1.4+B*.4,np.sin(2*np.pi*1900*ts(.05))*np.exp(-ts(.05)*140),.10)
for at in [bar_at(12)+BAR*3.25+.2,bar_at(16)+BAR*2.3+.2,bar_at(19)+BAR*1.25+.2,bar_at(22)+BAR*1.8+.17]:
 add(at,kick(.9),.6);add(at,noise(.12,30,False),.10)
# ruleta: tic-tic care încetinește
p=0
while True:
 x=p/(BAR*1.8)
 if x>=1:break
 add(bar_at(22)+p,np.sin(2*np.pi*2600*ts(.025))*np.exp(-ts(.025)*200),.06)
 p+=.05+.25*x**2
# finalul: acordul ținut și coada
add(bar_at(28),pad(CH[0],DUR-bar_at(28)+.3),.12)
mix=mix[:int(SR*DUR)]
fade=np.ones(len(mix));fade[:int(.03*SR)]=np.linspace(0,1,int(.03*SR));fade[-int(1.2*SR):]=np.linspace(1,0,int(1.2*SR))
mix*=fade[:,None];mix=np.tanh(mix*1.1)*.8
path=pathlib.Path(__file__).resolve().parents[2]/'release/video/CeFaci-original-soundtrack-v3.wav'
path.parent.mkdir(parents=True,exist_ok=True)
with wave.open(str(path),'wb') as w:
 w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((mix*32767).astype('<i2').tobytes())
print(path)
