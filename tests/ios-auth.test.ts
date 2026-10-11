import {it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({createClient:vi.fn()}));
vi.mock('../mobile/node_modules/react-native',()=>({Platform:{OS:'ios'}}));
vi.mock('../mobile/node_modules/@supabase/supabase-js',()=>({createClient:mocks.createClient}));
import {googleSignInAvailable,signInWithGoogle} from '../mobile/src/lib/auth';
it('iOS does not launch an unconfigured Google SDK or contact Supabase through that action',async()=>{
 expect(googleSignInAvailable).toBe(false);
 expect(await signInWithGoogle()).toBe('Pe iOS, intră cu emailul.');
 expect(mocks.createClient).not.toHaveBeenCalled();
});
