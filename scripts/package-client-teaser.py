"""Verify the actual MP4 and assemble a TikTok upload kit (no campaign publishing)."""
import hashlib,json,pathlib,re,shutil,subprocess,zipfile
root=pathlib.Path(__file__).resolve().parents[1]
folder=root/'release/video'
video=folder/'CeFaci-Client-teaser-48s.mp4'
def run(args):return subprocess.run(args,check=True,capture_output=True,text=True)
probe=json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(video)]).stdout)
v=next(s for s in probe['streams'] if s['codec_type']=='video')
a=next(s for s in probe['streams'] if s['codec_type']=='audio')
assert v['codec_name']=='h264' and v['pix_fmt']=='yuv420p'
assert (v['width'],v['height'],v['r_frame_rate'])==(1080,1920,'30/1')
assert v['color_range']=='tv' and v['color_space']=='bt709'
assert a['codec_name']=='aac' and a['channels']==2 and a['sample_rate']=='48000'
assert abs(float(probe['format']['duration'])-48)<.05
assert int(v['nb_frames'])==1440
assert int(v['bit_rate'])>=516000 and video.stat().st_size<500_000_000
decoded=run(['ffmpeg','-hide_banner','-nostats','-v','error','-i',str(video),'-f','null','-'])
assert not decoded.stderr.strip(),decoded.stderr
loud=run(['ffmpeg','-hide_banner','-nostats','-i',str(video),'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json','-f','null','-'])
audio_measure=json.loads(re.findall(r'\{[\s\S]*?\}',loud.stderr)[-1])
assert float(audio_measure['input_tp'])<-.1,'Audio clips or lacks true-peak headroom'
cover=folder/'CeFaci-Client-teaser-cover.jpg'
run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss','46','-i',str(video),'-frames:v','1',str(cover)])
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
creative=root/'marketing/client-teaser'
source=run(['git','-C',str(root),'rev-parse','HEAD']).stdout.strip()
report={'created_for':'CeFaci Client pre-launch TikTok Ads creative','source_commit':source,'duration_seconds':48,'width':1080,'height':1920,'aspect_ratio':'9:16','fps':30,'frames':1440,'video_codec':'h264','pixel_format':'yuv420p','color_space':'bt709','color_range':'tv','video_bitrate':int(v['bit_rate']),'audio_codec':'aac','audio_sample_rate':48000,'audio_channels':2,'size_bytes':video.stat().st_size,'full_decode_passed':True,'integrated_lufs':float(audio_measure['input_i']),'true_peak_dbtp':float(audio_measure['input_tp']),'soundtrack':'Original procedural synthesis; no imported samples or voices','platform_approval':'Not submitted; no guarantee of TikTok review outcome','website_status':'New web ZIP prepared; hosting upload and complete operator identity still required','files':{p.name:sha(p) for p in [video,cover,folder/'CeFaci-original-soundtrack.wav']},'inputs':{str(p.relative_to(root)):sha(p) for p in [creative/'scene.html',creative/'bilu.svg',creative/'soundtrack.py',root/'scripts/render-client-teaser.mjs',root/'website/assets/acasa.webp',root/'website/assets/plan.webp',root/'website/assets/surpriza.webp']}}
doc=root/'docs/livrare/VIDEO-TIKTOK-20261010.json'
doc.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
kit=folder/'CeFaci-TikTok-Ads-kit.zip'
with zipfile.ZipFile(kit,'w',compression=zipfile.ZIP_DEFLATED) as z:
 for p,name in [(video,video.name),(cover,cover.name),(folder/'CeFaci-original-soundtrack.wav','CeFaci-original-soundtrack.wav'),(creative/'README.md','INSTRUCTIUNI-TIKTOK-ADS.md'),(creative/'RIGHTS.md','PROVENIENTA-DREPTURI.md'),(creative/'soundtrack.py','source/soundtrack.py'),(doc,'VERIFICARE-VIDEO.json')]:z.write(p,name)
checks=''.join(sha(p)+'  '+p.name+'\n' for p in [video,cover,kit,folder/'CeFaci-original-soundtrack.wav'])
(folder/'SHA256SUMS.txt').write_text(checks)
(root/'docs/livrare/VIDEO-TIKTOK-SHA256.txt').write_text(checks)
with zipfile.ZipFile(kit) as z:assert z.testzip() is None
print(json.dumps({'video':str(video),'kit':str(kit),'checks':'PASS: 1440 frames, full MP4 decode, 48s, Full HD 9:16 H264 TV/bt709, AAC stereo, bitrate/filesize, audio true peak, SHA256/ZIP CRC','size_mb':round(video.stat().st_size/1e6,2),'lufs':report['integrated_lufs'],'true_peak':report['true_peak_dbtp']},ensure_ascii=False))
