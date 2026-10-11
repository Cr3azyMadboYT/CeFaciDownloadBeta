import {View} from 'react-native';
import {useTheme} from '../../shared/theme';
import {LegalReaderNative} from '../../shared/LegalReaderNative';
import {PrivacyPanelNative} from '../../shared/PrivacyPanelNative';
import {Bilu} from '../../shared/Bilu';
import {call} from './backend';
import {Card, Txt} from './ui';
export function BusinessPrivacy({identity}: {identity: string}) {
  const {t} = useTheme();
  return <View style={{gap: 20}}><Card title="Confidențialitate și termeni"><Bilu size={70} mood="hi" still/><Txt>O explicație clară despre datele tale, drepturi și folosirea CeFaci Business.</Txt><LegalReaderNative audience="business" theme={t}/></Card><Card><PrivacyPanelNative identity={identity} scope="business" call={call} theme={t}/></Card></View>;
}
