// The results on a real map (decision Cornel, 04.10): MapLibre with OpenFreeMap's free tiles, inside a WebView, no
// key and nothing to pay. Numbered pins for the places, a dot for where you start, and for "Seara completă" a line
// through the steps in order. Tapping a pin opens its card; "Asta!" on the card picks the place.
import { useMemo } from 'react';
import { Linking, Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Muted } from './kit';
import { useTheme } from './theme';

export interface MapPin { id: string; lat: number; lon: number; name: string; sub: string; bg: string; fg: string; n: number; hot?: boolean }

function html(pins: MapPin[], origin: { lat: number; lon: number; label: string }, line: boolean, dark: boolean, pick: boolean) {
  const data = JSON.stringify({ pins, origin, line, dark, pick }).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css" onerror="this.href='https://cdn.jsdelivr.net/npm/maplibre-gl@5.6.0/dist/maplibre-gl.css'">
<style>html,body,#m{margin:0;height:100%;background:${dark ? '#0B1030' : '#EEF1FB'};font-family:system-ui,sans-serif}
.pin{width:30px;height:30px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font:800 14px system-ui;box-shadow:0 3px 8px rgba(14,20,64,.35)}
.pin.hot{width:36px;height:36px;font-size:16px;border-color:#FFD43B}
.me{width:16px;height:16px;border-radius:50%;background:#2F5BFF;border:3px solid #fff;box-shadow:0 0 0 6px rgba(47,91,255,.25)}
.card{font:600 14px system-ui;color:#0E1440;max-width:200px}.card b{display:block;font-size:15px;margin-bottom:2px}.card small{color:#5A6390;display:block;margin-bottom:8px}
.card button{border:0;border-radius:10px;background:#2F5BFF;color:#fff;font:700 14px system-ui;padding:8px 14px}
.err{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#5A6390;font:600 14px system-ui;text-align:center;padding:20px}</style></head>
<body><div id="m"></div>
<script src="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js"></script>
<script>
(function(){
  var D=${data};
  function send(x){ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(x)); }
  function start(){
    if(!window.maplibregl){ document.body.innerHTML='<div class="err">Harta are nevoie de internet. Lista de mai jos merge și fără.</div>'; return; }
    var map=new maplibregl.Map({container:'m',style:'https://tiles.openfreemap.org/styles/liberty',center:[D.origin.lon,D.origin.lat],zoom:13,attributionControl:false});
    map.addControl(new maplibregl.AttributionControl({compact:true}),'top-right');
    var b=new maplibregl.LngLatBounds();b.extend([D.origin.lon,D.origin.lat]);
    var me=document.createElement('div');me.className='me';new maplibregl.Marker({element:me}).setLngLat([D.origin.lon,D.origin.lat]).setPopup(new maplibregl.Popup({offset:12}).setText(D.origin.label)).addTo(map);
    D.pins.forEach(function(p){
      var el=document.createElement('div');el.className='pin'+(p.hot?' hot':'');el.style.background=p.bg;el.style.color=p.fg;el.textContent=p.n;
      var c=document.createElement('div');c.className='card';
      c.innerHTML='<b></b><small></small>'+(D.pick?'<button>Asta!</button>':'');c.querySelector('b').textContent=p.name;c.querySelector('small').textContent=p.sub;
      if(D.pick) c.querySelector('button').onclick=function(){send({pick:p.id});};
      new maplibregl.Marker({element:el}).setLngLat([p.lon,p.lat]).setPopup(new maplibregl.Popup({offset:18,closeButton:false}).setDOMContent(c)).addTo(map);
      b.extend([p.lon,p.lat]);
    });
    map.on('load',function(){
      if(D.line&&D.pins.length>1){
        map.addSource('r',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:D.pins.map(function(p){return[p.lon,p.lat];})}}});
        map.addLayer({id:'r',type:'line',source:'r',paint:{'line-color':'#2F5BFF','line-width':4,'line-dasharray':[1.5,1.2]}});
      }
      if(D.pins.length) map.fitBounds(b,{padding:{top:64,bottom:84,left:48,right:48},maxZoom:15,duration:0});
      // the credit stays a small (i) until tapped, not a box over the map
      var a=document.querySelector('.maplibregl-ctrl-attrib');if(a) a.classList.remove('maplibregl-compact-show');
      send({ready:true});
    });
  }
  if(window.maplibregl) start(); else { var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/maplibre-gl@5.6.0/dist/maplibre-gl.js';s.onload=start;s.onerror=start;document.head.appendChild(s); }
})();
</script></body></html>`;
}

export function PlacesMap({ pins, origin, line = false, height = 360, onPick }: { pins: MapPin[]; origin: { lat: number; lon: number; label: string }; line?: boolean; height?: number; onPick?: (id: string) => void }) {
  const { t } = useTheme();
  const page = useMemo(() => html(pins, origin, line, t.dark, !!onPick), [pins, origin, line, t.dark, onPick]);
  if (Platform.OS === 'web') {
    return <View style={{ height: 120, borderRadius: 20, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}><Muted>Harta se vede în aplicația de telefon.</Muted></View>;
  }
  return (
    <View style={{ height, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: t.line }}>
      <WebView
        originWhitelist={['*']}
        source={{ html: page }}
        javaScriptEnabled
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        // only the map itself loads here; a link (the map's credits) opens in the browser
        onShouldStartLoadWithRequest={(req) => { if (/^(about:|data:)/.test(req.url)) return true; Linking.openURL(req.url).catch(() => {}); return false; }}
        onMessage={(e) => { try { const m = JSON.parse(e.nativeEvent.data); if (m.pick && onPick) onPick(m.pick); } catch { /* ignore */ } }}
        style={{ backgroundColor: t.bg }}
      />
    </View>
  );
}
