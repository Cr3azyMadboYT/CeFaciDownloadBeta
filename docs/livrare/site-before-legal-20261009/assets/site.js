'use strict';
const screens = {
  plan: {src:'assets/plan.webp',alt:'CeFaci: alegerea unui singur loc, a întregii seri sau a unui plan construit manual',caption:'Tu alegi cum începe seara.'},
  surpriza: {src:'assets/surpriza.webp',alt:'Ecranul Surprinde-mă din versiunea în dezvoltare a aplicației CeFaci',caption:'Pentru serile în care ai chef de ceva spontan.'},
  loc: {src:'assets/loc.webp',alt:'Pagina unui local din aplicația CeFaci, cu informații pentru ieșire',caption:'Un loc nou, direct în planul tău.'}
};
document.querySelectorAll('[data-screen]').forEach(button=>button.addEventListener('click',()=>{
  const screen=screens[button.dataset.screen]; if(!screen) return;
  const img=document.getElementById('app-screen'); img.src=screen.src; img.alt=screen.alt;
  document.getElementById('screen-caption').textContent=screen.caption;
  document.querySelectorAll('[data-screen]').forEach(b=>{const selected=b===button;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
}));
