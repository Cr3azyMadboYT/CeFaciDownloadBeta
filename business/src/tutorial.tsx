import {useEffect,useMemo,useRef,useState} from 'react';
import {AccessibilityInfo,Modal,Platform,Pressable,ScrollView,Text,View,useWindowDimensions} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {businessTutorial,businessRoleLabels,tutorialKey,TUTORIAL_DONE} from '../../shared/role-tutorials';
import {Bilu} from '../../shared/Bilu';
import {F,useTheme} from '../../shared/theme';
import {Button,Txt} from './ui';
export type BusinessTutorialProps={userId:string;role:string;venueId?:string;availableTabs:readonly string[];replayToken?:number;onNavigate:(tab:string)=>void;onHighlight?:(tab:string|null)=>void};
/** Place beside the workspace, outside its ScrollView. Navigation is the only callback it performs. */
export function BusinessTutorial({userId,role,venueId='',availableTabs,replayToken=0,onNavigate,onHighlight}:BusinessTutorialProps){
 const {t}=useTheme(),{width,height}=useWindowDimensions();
 const identity=tutorialKey('business',userId,role,venueId),tabKey=availableTabs.join('|');
 const steps=useMemo(()=>businessTutorial(role,availableTabs),[role,tabKey]);
 const [state,S]=useState({identity:'',open:false,step:0,collapsed:false});
 const current=useRef(identity);current.current=identity;
 const lastReplay=useRef(replayToken);
 const callbacks=useRef({onNavigate,onHighlight});callbacks.current={onNavigate,onHighlight};
 useEffect(()=>{let alive=true;const replay=replayToken!==lastReplay.current;lastReplay.current=replayToken;AsyncStorage.getItem(identity).catch(()=>null).then(done=>{if(alive&&current.current===identity)S({identity,open:!!steps.length&&(done!==TUTORIAL_DONE||replay),step:0,collapsed:false});});return()=>{alive=false;};},[identity,replayToken]);
 const active=state.identity===identity&&state.open&&!!steps.length,step=steps[Math.min(state.step,steps.length-1)];
 useEffect(()=>{if(!active||!step)return;callbacks.current.onHighlight?.(step.tab??null);if(step.tab)callbacks.current.onNavigate(step.tab);if(Platform.OS!=='web')AccessibilityInfo.announceForAccessibility(`${step.title} ${step.text}`);return()=>callbacks.current.onHighlight?.(null);},[identity,active,state.step,step?.id]);
 const finish=()=>{if(current.current!==state.identity)return;void AsyncStorage.setItem(identity,TUTORIAL_DONE).catch(()=>{});S(s=>({...s,open:false}));};
 if(!active||!step)return null;
 const welcome=state.step===0,last=state.step>=steps.length-1;
 const card=<View accessibilityViewIsModal={welcome} style={{width:Math.min(width-24,460),maxHeight:welcome?height-80:Math.max(220,height*.53),backgroundColor:t.s1,borderWidth:2,borderColor:'#FFD43B',borderRadius:24,padding:16,gap:10,shadowColor:'#040718',shadowOpacity:.28,shadowRadius:16,shadowOffset:{width:0,height:7},elevation:10}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:8}}><View style={{flex:1}}><Text style={{fontFamily:F.b,fontSize:12,color:'#0E1440',alignSelf:'flex-start',paddingVertical:6,paddingHorizontal:10,backgroundColor:'#FFD43B',borderRadius:99}}>Tur cu Bilu · {state.step+1}/{steps.length}</Text></View>{!welcome&&<Pressable accessibilityRole="button" accessibilityLabel={state.collapsed?'Extinde turul':'Minimizează turul'} onPress={()=>S(s=>({...s,collapsed:!s.collapsed}))} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:t.s2}}><Txt>{state.collapsed?'＋':'−'}</Txt></Pressable>}<Pressable accessibilityRole="button" accessibilityLabel="Închide turul" onPress={finish} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:t.s2}}><Txt>×</Txt></Pressable></View>
  {state.collapsed?<Button label={step.title} secondary onPress={()=>S(s=>({...s,collapsed:false}))}/>:<ScrollView contentContainerStyle={{gap:10}}><View style={{flexDirection:'row',alignItems:'center',gap:10}}><View accessible={false}><Bilu mood={welcome?'hi':last?'yay':'up'} size={welcome?92:64} still/></View><View style={{flex:1}}><Txt muted style={{fontSize:12}}>CeFaci Business · {businessRoleLabels[role]??role}</Txt><Text accessibilityRole="header" style={{fontFamily:F.display,fontSize:welcome?25:21,lineHeight:welcome?29:25,color:t.ink}}>{step.title}</Text></View></View><Text accessibilityLiveRegion="polite" style={{fontFamily:F.r,fontSize:15,lineHeight:22,color:t.ink}}>{step.text}</Text>{step.tip&&<View style={{backgroundColor:t.s2,borderRadius:14,padding:12}}><Txt muted style={{fontSize:13,lineHeight:19}}>{step.tip}</Txt></View>}<View accessibilityLabel={`Pasul ${state.step+1} din ${steps.length}`} style={{height:5,borderRadius:99,backgroundColor:t.s2,overflow:'hidden'}}><View style={{height:5,width:`${(state.step+1)/steps.length*100}%`,backgroundColor:'#FFD43B'}}/></View><View style={{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'flex-end'}}>{state.step>0&&<Button label="Înapoi" secondary onPress={()=>S(s=>({...s,step:s.step-1}))}/>} {step.tab&&<Button label={step.action??'Deschide ecranul'} secondary onPress={()=>callbacks.current.onNavigate(step.tab!)}/>}<Button label={last?'Hai la treabă!':welcome?'Arată-mi!':'Mai departe'} onPress={()=>{if(current.current!==state.identity)return;if(last)finish();else S(s=>({...s,step:s.step+1,collapsed:false}));}}/></View></ScrollView>}
 </View>;
 if(welcome)return <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={finish}><View style={{flex:1,backgroundColor:'rgba(4,7,24,.78)',justifyContent:'center',alignItems:'center',padding:12}}>{card}</View></Modal>;
 return <View pointerEvents="box-none" style={{position:'absolute',left:12,right:12,bottom:12,zIndex:100,alignItems:width>=920?'flex-end':'center'}}>{card}</View>;
}
