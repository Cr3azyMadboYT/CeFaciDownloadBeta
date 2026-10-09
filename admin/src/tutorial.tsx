import {useEffect,useMemo,useRef,useState} from 'react';
import {adminTutorial,tutorialKey,TUTORIAL_DONE,type AdminTourTab} from '../../shared/role-tutorials';
import {Bilu} from './ui';
import './tutorial.css';
export type AdminTutorialProps={userId:string;role:string;permissions:readonly string[];availableTabs?:readonly string[];replayToken?:number;onNavigate:(tab:AdminTourTab)=>void;onHighlight?:(tab:AdminTourTab|null)=>void};
/** Mounted only inside the verified dashboard; the tutorial never grants access or mutates server data. */
export function AdminTutorial({userId,role,permissions,availableTabs,replayToken=0,onNavigate,onHighlight}:AdminTutorialProps){
 const identity=tutorialKey('admin',userId,role),permissionKey=permissions.join('|'),tabKey=availableTabs?.join('|');
 const steps=useMemo(()=>adminTutorial(role,permissions,availableTabs),[role,permissionKey,tabKey]);
 const [state,S]=useState({identity:'',step:0,open:false,collapsed:false});
 const currentIdentity=useRef(identity);currentIdentity.current=identity;
 const lastReplay=useRef(replayToken);
 const callbacks=useRef({onNavigate,onHighlight});callbacks.current={onNavigate,onHighlight};
 const panel=useRef<HTMLElement|null>(null),heading=useRef<HTMLHeadingElement|null>(null);
 useEffect(()=>{const replay=replayToken!==lastReplay.current;lastReplay.current=replayToken;let done=false;try{done=localStorage.getItem(identity)===TUTORIAL_DONE;}catch{/* Guidance works even with storage disabled. */}S({identity,step:0,open:!!steps.length&&(!done||replay),collapsed:false});},[identity,replayToken]);
 const active=state.identity===identity&&state.open&&!!steps.length;
 const welcome=state.step===0,last=state.step>=steps.length-1;
 const step=steps[Math.min(state.step,steps.length-1)];
 useEffect(()=>{if(!active||!welcome)return;const elements=Array.from(document.querySelectorAll<HTMLElement>('.shell > aside,.shell > main')).filter(element=>!element.contains(panel.current));const prior=elements.map(element=>element.hasAttribute('inert'));elements.forEach(element=>element.setAttribute('inert',''));return()=>elements.forEach((element,index)=>{if(!prior[index])element.removeAttribute('inert');});},[active,welcome]);
 useEffect(()=>{if(!active)return;const previous=document.activeElement as HTMLElement|null;return()=>{if(previous?.isConnected)previous.focus({preventScroll:true});};},[active,identity]);
 useEffect(()=>{
  if(!active||!step)return;
  const tab=step.tab as AdminTourTab|undefined;let target:HTMLElement|null=null;
  if(tab){callbacks.current.onNavigate(tab);callbacks.current.onHighlight?.(tab);target=document.querySelector<HTMLElement>(`[data-tour-tab="${tab}"]`);target?.classList.add('bilu-tour-target');target?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});}
  heading.current?.focus({preventScroll:true});
  return()=>{target?.classList.remove('bilu-tour-target');callbacks.current.onHighlight?.(null);};
 },[active,identity,state.step,step?.id]);
 const finish=()=>{if(currentIdentity.current!==state.identity)return;try{localStorage.setItem(identity,TUTORIAL_DONE);}catch{}S(s=>({...s,open:false}));};
 useEffect(()=>{if(!active)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();finish();}};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[active,identity]);
 if(!active||!step)return null;
 const advance=()=>{if(currentIdentity.current!==state.identity)return;if(last)finish();else S(s=>({...s,step:s.step+1,collapsed:false}));};
 const trap=(event:React.KeyboardEvent)=>{if(!welcome||event.key!=='Tab'||!panel.current)return;const controls=Array.from(panel.current.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]'));const first=controls[0],last=controls[controls.length-1],inside=controls.includes(document.activeElement as HTMLElement);if(event.shiftKey&&(!inside||document.activeElement===first)){event.preventDefault();last?.focus();}else if(!event.shiftKey&&(!inside||document.activeElement===last)){event.preventDefault();first?.focus();}};
 return <div className={welcome?'bilu-tour-welcome':'bilu-tour-layer'}><section ref={panel} className={'bilu-tour-card'+(state.collapsed?' collapsed':'')} role={welcome?'dialog':'region'} aria-modal={welcome||undefined} aria-labelledby="bilu-tour-title" aria-describedby="bilu-tour-description" onKeyDown={trap}>
  <div className="bilu-tour-top"><span className="bilu-tour-badge">Tur cu Bilu · {state.step+1}/{steps.length}</span>{!welcome&&<button aria-label={state.collapsed?'Extinde turul':'Minimizează turul'} onClick={()=>S(s=>({...s,collapsed:!s.collapsed}))}>{state.collapsed?'＋':'−'}</button>}<button aria-label="Închide turul" onClick={finish}>×</button></div>
  {!state.collapsed&&<><div className="bilu-tour-intro"><Bilu/><div><p className="eyebrow">CeFaci Admin · {role}</p><h2 id="bilu-tour-title" tabIndex={-1} ref={heading}>{step.title}</h2></div></div><p id="bilu-tour-description" aria-live="polite">{step.text}</p>{step.tip&&<p className="bilu-tour-tip">{step.tip}</p>}<div className="bilu-tour-progress" aria-label={`Pasul ${state.step+1} din ${steps.length}`}><span className={`bilu-tour-progress-${Math.round((state.step+1)/steps.length*10)}`}/></div><div className="bilu-tour-actions">{state.step>0&&<button onClick={()=>S(s=>({...s,step:s.step-1}))}>Înapoi</button>}{step.tab&&<button onClick={()=>callbacks.current.onNavigate(step.tab as AdminTourTab)}>{step.action??'Deschide ecranul'}</button>}<button className="primary" onClick={advance}>{last?'Hai la treabă!':welcome?'Arată-mi!':'Mai departe'}</button></div></>}
  {state.collapsed&&<button id="bilu-tour-title" onClick={()=>S(s=>({...s,collapsed:false}))}>{step.title}</button>}
 </section></div>;
}
