"""Original 48-second electronic cue; no samples, third-party music or voices."""
import pathlib,wave
import numpy as np
SR=48000
duration=48
mix=np.zeros((SR*duration,2),dtype=np.float64)
rng=np.random.default_rng(1048)
def add(at,sound,amp=1,pan=0):
 start=int(at*SR); end=min(start+len(sound),len(mix)); sound=sound[:end-start]*amp
 if end<=start:return
 mix[start:end,0]+=sound*np.sqrt((1-pan)/2)
 mix[start:end,1]+=sound*np.sqrt((1+pan)/2)
def tone(freq,seconds,decay=5):
 t=np.arange(int(seconds*SR))/SR
 return (np.sin(2*np.pi*freq*t)+.28*np.sin(2*np.pi*freq*2*t)+.1*np.sin(2*np.pi*freq*3*t))*np.exp(-t*decay)*np.minimum(t*120,1)
roots=[73.416,58.27,87.307,65.406]
for beat in range(96):
 at=beat*.5
 energy=.45 if at<5 else 1
 if at>=44:energy=.6
 t=np.arange(int(.26*SR))/SR
 kick=np.sin(2*np.pi*(49*t+105*.035*(1-np.exp(-t/.035))))*np.exp(-t*19)
 add(at,kick,.63*energy)
 if beat%2:
  t=np.arange(int(.16*SR))/SR
  noise=rng.normal(0,1,len(t));noise=np.concatenate(([0],np.diff(noise)))
  add(at,noise*np.exp(-t*34),.12*energy)
 for sub in [0,.25]:
  t=np.arange(int(.07*SR))/SR;noise=rng.normal(0,1,len(t));noise=np.concatenate(([0],np.diff(noise)))
  add(at+sub,noise*np.exp(-t*80),.025*energy,(-1 if beat%2 else 1)*.4)
 root=roots[(beat//8)%4]
 if at>=5:
  add(at,tone(root,.43,5),.24*energy)
  intervals=[12,19,15,24,19,15,22,19]
  note=root*2**(intervals[beat%8]/12)
  add(at+.25,tone(note,.4,7),.10*energy,.3 if beat%2 else -.3)
  add(at+.4375,tone(note,.32,9),.025*energy,-.3 if beat%2 else .3)
for cut in [5,9,13,20,27,34,40,44]:
 t=np.arange(int(.45*SR))/SR
 whoosh=rng.normal(0,1,len(t));whoosh=np.convolve(whoosh,np.ones(12)/12,'same')
 add(cut-.22,whoosh*np.sin(np.pi*t/.45)**2,.11)
 add(cut,tone(587.33,.4,9),.07)
# Gentle fade preserves the final title hold and avoids clicks.
fade=np.ones(len(mix));fade[:int(.06*SR)]=np.linspace(0,1,int(.06*SR));fade[-int(.8*SR):]=np.linspace(1,0,int(.8*SR))
mix*=fade[:,None]
mix=np.tanh(mix)*.78
path=pathlib.Path(__file__).resolve().parents[2]/'release/video/CeFaci-original-soundtrack.wav'
path.parent.mkdir(parents=True,exist_ok=True)
with wave.open(str(path),'wb') as w:
 w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((mix*32767).astype('<i2').tobytes())
print(path)
