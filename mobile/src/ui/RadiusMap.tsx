// "Cât de departe ai merge?" on a real map (decision Cornel, 04.10): the point you set off from as a yellow pin you can
// hold and move to where you live, and the circle of the radius around it. MapLibre with OpenFreeMap's free tiles in
// a WebView, like the results map; the radius changes without reloading the map.
import { useEffect, useMemo, useRef } from 'react';
import { Linking, Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Muted } from './kit';
import { useTheme } from './theme';
import { mapLink } from '../lib/links';

function html(p: { lat: number; lon: number }, r: number, dark: boolean, movable: boolean) {
  const data = JSON.stringify({ p, r, movable }).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" integrity="sha384-Nq6PQ+9vJPvw7U/VfDELyrWoGQMsy0gi6QShhaSrGzkpF5KkM40csg2leky+YMTd" crossorigin="anonymous" href="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css" onerror="this.href='https://cdn.jsdelivr.net/npm/maplibre-gl@5.6.0/dist/maplibre-gl.css'">
<style>html,body,#m{margin:0;height:100%;background:${dark ? '#0B1030' : '#EEF1FB'}}
.pin{width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#FFD43B;border:3px solid #0E1440;box-shadow:0 3px 8px rgba(14,20,64,.35)}
.err{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#5A6390;font:600 14px system-ui;text-align:center;padding:20px}</style></head>
<body><div id="m"></div>
<script integrity="sha384-GfxBM9x46BaAFxtCq39Fxir8fNZ4VDnwgfi6Kzi5/F1tAFsm0amuuV8kd+Pxzuf/" crossorigin="anonymous" src="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js"></script>
<script>
(function(){
  var D=${data}, map, marker;
  function send(x){ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(x)); }
  function ring(lat, lon, km){
    var pts=[], R=6371, d=km/R, la=lat*Math.PI/180, lo=lon*Math.PI/180;
    for(var i=0;i<=72;i++){ var b=i/72*2*Math.PI;
      var la2=Math.asin(Math.sin(la)*Math.cos(d)+Math.cos(la)*Math.sin(d)*Math.cos(b));
      var lo2=lo+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(la),Math.cos(d)-Math.sin(la)*Math.sin(la2));
      pts.push([lo2*180/Math.PI, la2*180/Math.PI]); }
    return {type:'Feature',geometry:{type:'Polygon',coordinates:[pts]}};
  }
  function fit(){ var c=ring(D.p.lat,D.p.lon,D.r).geometry.coordinates[0], b=new maplibregl.LngLatBounds(); c.forEach(function(x){b.extend(x);}); map.fitBounds(b,{padding:24,duration:250}); }
  function draw(){ if(!map||!map.getSource('c')) return; map.getSource('c').setData(ring(D.p.lat,D.p.lon,D.r)); }
  // until the map is up these only remember the values; the app sends the latest ones again on "ready"
  window.setR=function(km){ D.r=km; if(map&&map.getSource('c')){ draw(); fit(); } };
  window.setP=function(lat,lon){ D.p={lat:lat,lon:lon}; if(marker) marker.setLngLat([lon,lat]); if(map&&map.getSource('c')){ draw(); fit(); } };
  function start(){
    if(!window.maplibregl){ document.body.innerHTML='<div class="err">Harta are nevoie de internet. Raza merge și fără ea.</div>'; return; }
    map=new maplibregl.Map({container:'m',style:'https://tiles.openfreemap.org/styles/liberty',center:[D.p.lon,D.p.lat],zoom:11,attributionControl:{compact:true}});
    var el=document.createElement('div');el.className='pin';
    marker=new maplibregl.Marker({element:el,draggable:D.movable,anchor:'bottom'}).setLngLat([D.p.lon,D.p.lat]).addTo(map);
    marker.on('drag',function(){ var q=marker.getLngLat(); D.p={lat:q.lat,lon:q.lng}; draw(); });
    marker.on('dragend',function(){ var q=marker.getLngLat(); send({moved:{lat:q.lat,lon:q.lng}}); });
    map.on('load',function(){
      map.addSource('c',{type:'geojson',data:ring(D.p.lat,D.p.lon,D.r)});
      map.addLayer({id:'cf',type:'fill',source:'c',paint:{'fill-color':'#2F5BFF','fill-opacity':0.12}});
      map.addLayer({id:'cl',type:'line',source:'c',paint:{'line-color':'#2F5BFF','line-width':2.5}});
      fit(); send({ready:true});
    });
  }
  if(window.maplibregl) start(); else { var s=document.createElement('script');s.integrity='sha384-GfxBM9x46BaAFxtCq39Fxir8fNZ4VDnwgfi6Kzi5/F1tAFsm0amuuV8kd+Pxzuf/';s.crossOrigin='anonymous';s.src='https://cdn.jsdelivr.net/npm/maplibre-gl@5.6.0/dist/maplibre-gl.js';s.onload=start;s.onerror=start;document.head.appendChild(s); }
})();
</script></body></html>`;
}

/** The point and its circle; `onMove` gets where the pin was dropped (only when `movable`). */
export function RadiusMap({ point, km, height = 260, movable = true, onMove }: { point: { lat: number; lon: number }; km: number; height?: number; movable?: boolean; onMove?: (p: { lat: number; lon: number }) => void }) {
  const { t } = useTheme();
  const ref = useRef<WebView>(null);
  // the page is made once for a point; the radius (and a point chosen from the list) are sent to it after
  const first = useRef({ point, km });
  const page = useMemo(() => html(first.current.point, first.current.km, t.dark, movable), [t.dark, movable]);
  const shown = useRef(point);
  // the latest values, sent again when the page says it is ready (changes made while the map was loading, or a
  // page rebuilt for the theme, would otherwise show the first point and radius)
  const latest = useRef({ point, km });
  latest.current = { point, km };
  const resend = () => {
    const { point: p, km: r } = latest.current;
    shown.current = p;
    ref.current?.injectJavaScript('window.setP&&window.setP(' + Number(p.lat) + ',' + Number(p.lon) + ');window.setR&&window.setR(' + Number(r) + ');true;');
  };
  useEffect(() => { ref.current?.injectJavaScript('window.setR&&window.setR(' + Number(km) + ');true;'); }, [km]);
  useEffect(() => {
    if (shown.current.lat === point.lat && shown.current.lon === point.lon) return;
    shown.current = point;
    ref.current?.injectJavaScript('window.setP&&window.setP(' + Number(point.lat) + ',' + Number(point.lon) + ');true;');
  }, [point]);
  if (Platform.OS === 'web') {
    return <View style={{ height: 120, borderRadius: 20, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}><Muted>Harta se vede în aplicația de telefon.</Muted></View>;
  }
  return (
    <View style={{ height, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: t.line }}>
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html: page }}
        javaScriptEnabled
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(req) => { if (/^(about:|data:)/.test(req.url)) return true; const u = mapLink(req.url); if (u) Linking.openURL(u).catch(() => {}); return false; }}
        onMessage={(e) => { try { const m = JSON.parse(e.nativeEvent.data); if (m.ready) resend(); if (m.moved && onMove && Number.isFinite(m.moved.lat) && Number.isFinite(m.moved.lon) && m.moved.lat > 43.9 && m.moved.lat < 45 && m.moved.lon > 25.3 && m.moved.lon < 26.9) { const at = { lat: Number(m.moved.lat), lon: Number(m.moved.lon) }; shown.current = at; onMove(at); } } catch { /* ignore */ } }}
        style={{ backgroundColor: t.bg }}
      />
    </View>
  );
}
