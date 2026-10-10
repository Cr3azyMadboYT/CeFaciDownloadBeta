# Bilu Business · servietă mare

Grafica păstrează familia Clientului. Primăvară: flori; vară: ochelari și înghețată; toamnă: frunză și fular; iarnă: căciulă și mănuși; Crăciun: căciulă roșie. Servieta este vizibilă în toate variantele. Propunerile originale rămân în `design/proposals/business-icon/`.

Calendarul comun este în `src/app/season.ts`: martie–mai / iunie–august / septembrie–noiembrie / restul iarnă, cu Crăciun de la 1 decembrie până la 7 ianuarie inclusiv, după data locală a dispozitivului.

`*.png`: iconițe complete; `*-fg.png`: personaje transparente; `*-bg.png`: fundalurile Clientului. Pluginul Business generează resursele native. Android aplică un inset de 27% pentru ca silueta și servieta să încapă în cercul sigur 66/108 al adaptive icons; iconițele vechi se generează la 192 px. Pentru iOS se generează cataloage de 1024 px și setările Xcode pentru iconițe alternative.

Android schimbă aliasul când aplicația trece în fundal, fără o a doua intrare permanentă. Android 13+ aplică schimbarea atomic; versiunile mai vechi activează noul alias înainte de a dezactiva celelalte. iOS folosește API-ul public UIKit la revenirea în prim-plan și poate afișa confirmarea standard a sistemului. Lansatorul poate păstra temporar un cache. O aplicație închisă complet nu schimbă iconița până la următoarea folosire.

Proiectele iOS pot fi generate și inspectate pe Ubuntu, dar compilarea și validarea pe dispozitiv necesită macOS/Xcode. APK/AAB se construiesc și se verifică în workflow-ul Android după suita de teste.
