import type { Language } from '@/lib/i18n/language';

/**
 * Versionshistorie der App, gepflegt vom Deploy-Skill (`.claude/skills/deploy`).
 *
 * Neue Einträge kommen immer oben dazu. Jeder Punkt beschreibt eine Änderung, die in der App
 * sichtbar oder spürbar ist: keine Umbauten im Code, keine Abhängigkeiten, keine Tests.
 * Kurz halten, ein Satz pro Punkt. Jeder Eintrag steht in allen Sprachen der App, mit gleich vielen
 * Punkten in derselben Reihenfolge; die App zeigt die Sprache, die gerade eingestellt ist. Einträge
 * von vor Version 1.0.29 gibt es nur auf Deutsch und Englisch, die übrigen Sprachen zeigen dort das
 * Englische.
 */
export interface Release {
  /** Muss der `version` in `app.json` entsprechen. */
  version: string;
  /** Erscheinungsdatum als `YYYY-MM-DD`. */
  date: string;
  /** Kurze Stichpunkte je Sprache, jeweils ohne Satzzeichen am Ende. */
  changes: { de: string[]; en: string[] } & Partial<Record<Language, string[]>>;
  /**
   * Optional eine Zeile, die im Play Store unter „Neu in dieser Version“ über den Stichpunkten
   * steht, etwa bei einem großen Update. Nur dort, nicht in der App und nicht im GitHub-Release.
   */
  storeIntro?: Partial<Record<Language, string>>;
  /** Optional: nur so viele Punkte im Play Store, wenn alle zusammen über die 500 Zeichen dort kämen. */
  storePoints?: number;
}

/** The points of `release` in `language`, English where an older entry lacks that language. */
export function changesIn(release: Release, language: Language): string[] {
  return release.changes[language] ?? release.changes.en;
}

export const RELEASES: Release[] = [
  {
    version: '1.1.0',
    date: '2026-11-28',
    changes: {
      de: [
        'Selbstversuche: Nimm dir ein paar Wochen etwas vor und vergleiche deine Einträge davor und währenddessen',
        'Mehrere Einträge und Erinnerungen pro Tag, die Stimmung lässt sich direkt in der Erinnerung antippen',
        'Automatische Sicherung in einen selbst gewählten Ordner und ein Bericht als PDF für Arzt oder Therapie',
        'Zahl-Skalen mit Einheit und Nachkommastellen, etwa fürs Gewicht, und eine eigene Seite je Skala',
        'Neue Auswertungen zu Notizen: Wörter je Skala und eine Seite für jedes Wort',
      ],
      en: [
        'Self-experiments: take something on for a few weeks and Daylight puts your entries from before and during side by side',
        'Several entries and reminders per day, and you can tap your mood right in the reminder',
        'Automatic backup to a folder of your choice and a PDF report for your doctor or therapist',
        'Number scales with a unit and decimals, for example for weight, and a page of its own for every scale',
        'New insights on notes: words per scale and a page for every word',
      ],
      es: [
        'Autoexperimentos: proponte algo unas semanas y compara tus entradas de antes y de durante',
        'Varias entradas y recordatorios al día, y el estado de ánimo se puede tocar directamente en el recordatorio',
        'Copia de seguridad automática en una carpeta elegida y un informe en PDF para tu médico o terapeuta',
        'Escalas numéricas con unidad y decimales, como el peso, y una página para cada escala',
        'Nuevos análisis de las notas: palabras por escala y una página para cada palabra',
      ],
      pt: [
        'Autoexperimentos: proponha algo por algumas semanas e o Daylight coloca seus registros de antes e de durante lado a lado',
        'Vários registros e lembretes por dia, e o humor pode ser tocado direto no lembrete',
        'Backup automático em uma pasta escolhida e um relatório em PDF para seu médico ou terapeuta',
        'Escalas numéricas com unidade e casas decimais, por exemplo para o peso, e uma página própria para cada escala',
        'Novas análises das notas: palavras por escala e uma página para cada palavra',
      ],
      fr: [
        'Auto-expériences : fixe-toi un objectif pour quelques semaines, Daylight compare tes entrées d’avant et de pendant',
        'Plusieurs entrées et rappels par jour, et l’humeur se choisit directement dans le rappel',
        'Sauvegarde automatique dans un dossier de ton choix et un rapport PDF pour ton médecin ou ton thérapeute',
        'Échelles numériques avec unité et décimales, par exemple pour le poids, et une page pour chaque échelle',
        'Nouveaux aperçus des notes : mots par échelle et une page pour chaque mot',
      ],
      it: [
        'Autoesperimenti: prenditi un impegno per qualche settimana e Daylight mette a confronto le voci di prima e di durante',
        'Più voci e promemoria al giorno, e l’umore si tocca direttamente nel promemoria',
        'Backup automatico in una cartella a scelta e un report in PDF per il medico o il terapeuta',
        'Scale numeriche con unità e decimali, per esempio per il peso, e una pagina per ogni scala',
        'Nuove analisi delle note: parole per scala e una pagina per ogni parola',
      ],
      nl: [
        'Zelfexperimenten: neem je iets voor voor een paar weken en Daylight zet je notities van ervoor en tijdens naast elkaar',
        'Meerdere notities en herinneringen per dag, en je tikt je stemming direct in de herinnering aan',
        'Automatische back-up naar een map naar keuze en een pdf-verslag voor je arts of therapeut',
        'Getalschalen met eenheid en decimalen, bijvoorbeeld voor je gewicht, en een eigen pagina voor elke schaal',
        'Nieuwe inzichten in notities: woorden per schaal en een pagina voor elk woord',
      ],
      pl: [
        'Eksperymenty na sobie: postanów coś na kilka tygodni, a Daylight zestawi wpisy sprzed eksperymentu i z jego trwania',
        'Kilka wpisów i przypomnień dziennie, a nastrój można wybrać od razu w przypomnieniu',
        'Automatyczna kopia zapasowa w wybranym folderze i raport PDF dla lekarza lub terapeuty',
        'Skale liczbowe z jednostką i miejscami po przecinku, na przykład dla wagi, oraz osobna strona dla każdej skali',
        'Nowe analizy notatek: słowa według skali i strona dla każdego słowa',
      ],
      tr: [
        'Kişisel deneyler: birkaç haftalığına bir şey dene, Daylight öncesindeki ve sırasındaki kayıtlarını yan yana koyar',
        'Günde birden fazla kayıt ve hatırlatıcı, ruh halini doğrudan hatırlatıcıdan seçebilirsin',
        'Seçtiğin bir klasöre otomatik yedekleme ve doktorun ya da terapistin için PDF rapor',
        'Birim ve ondalıklı sayısal ölçekler, örneğin kilo için, ve her ölçek için ayrı bir sayfa',
        'Notlar için yeni içgörüler: ölçeğe göre kelimeler ve her kelime için bir sayfa',
      ],
      id: [
        'Eksperimen pribadi: coba sesuatu selama beberapa minggu dan Daylight menyandingkan catatanmu sebelum dan selama itu',
        'Beberapa catatan dan pengingat per hari, dan suasana hati bisa langsung diketuk di pengingat',
        'Cadangan otomatis ke folder pilihanmu dan laporan PDF untuk dokter atau terapis',
        'Skala angka dengan satuan dan desimal, misalnya untuk berat badan, dan halaman sendiri untuk tiap skala',
        'Wawasan baru tentang catatan: kata per skala dan halaman untuk tiap kata',
      ],
    },
  },
  {
    version: '1.0.41',
    date: '2026-11-25',
    storePoints: 5,
    storeIntro: {
      de: 'Das bisher größte Update von Daylight:',
      en: 'The biggest Daylight update so far:',
      es: 'La mayor actualización de Daylight hasta ahora:',
      pt: 'A maior atualização do Daylight até agora:',
      fr: 'La plus grande mise à jour de Daylight à ce jour :',
      it: 'Il più grande aggiornamento di Daylight finora:',
      nl: 'De grootste update van Daylight tot nu toe:',
      pl: 'Największa jak dotąd aktualizacja Daylight:',
      tr: 'Daylight\'ın bugüne kadarki en büyük güncellemesi:',
      id: 'Pembaruan Daylight terbesar sejauh ini:',
    },
    changes: {
      de: [
        'Vier Widgets für den Startbildschirm: Stimmung, Verlauf, Serie und Neuer Eintrag, mit einstellbarem Hintergrund und Farben',
        'Neues Erscheinungsbild unter „Mehr“: System, Hell oder Dunkel',
        'Daylight gibt es jetzt auch auf Niederländisch, Polnisch, Türkisch und Indonesisch',
        'Das Jahr in Pixeln lässt sich groß öffnen, als PNG speichern und teilen',
        'Unter „Über“ führen Links zur Website und zum Quellcode auf GitHub',
        'Auf Tablets steht die Beschriftung in der Tab-Leiste wieder sauber unter dem Symbol',
        'Mengenangaben stehen jetzt in allen Sprachen in der richtigen Form',
      ],
      en: [
        'Four home screen widgets: Mood, History, Streak and New entry, with adjustable background and colours',
        'New appearance setting under “More”: System, Light or Dark',
        'Daylight now speaks Dutch, Polish, Turkish and Indonesian',
        'The year in pixels opens full screen and can be saved as a PNG or shared',
        '“About” now links to the website and to the source code on GitHub',
        'On tablets the tab bar labels sit neatly below their icons again',
        'Counts now use the right grammatical form in every language',
      ],
      es: [
        'Cuatro widgets para la pantalla de inicio: Estado de ánimo, Historial, Racha y Nueva entrada, con fondo y colores ajustables',
        'Nueva apariencia en «Más»: Sistema, Claro u Oscuro',
        'Daylight ya está también en neerlandés, polaco, turco e indonesio',
        'El año en píxeles se abre a pantalla completa y se puede guardar como PNG o compartir',
        'En «Acerca de» hay enlaces a la web y al código fuente en GitHub',
        'En tabletas, los nombres de la barra de pestañas vuelven a quedar bien debajo de su icono',
        'Las cantidades usan ahora la forma gramatical correcta en todos los idiomas',
      ],
      pt: [
        'Quatro widgets para a tela inicial: Humor, Histórico, Sequência e Novo registro, com fundo e cores ajustáveis',
        'Nova aparência em “Mais”: Sistema, Claro ou Escuro',
        'O Daylight agora também está em holandês, polonês, turco e indonésio',
        'O ano em pixels abre em tela cheia e pode ser salvo como PNG ou compartilhado',
        'Em “Sobre” há links para o site e para o código-fonte no GitHub',
        'Em tablets, os nomes na barra de abas voltam a ficar certinhos abaixo do ícone',
        'As quantidades agora usam a forma gramatical certa em todos os idiomas',
      ],
      fr: [
        'Quatre widgets pour l’écran d’accueil : Humeur, Historique, Série et Nouvelle entrée, avec fond et couleurs réglables',
        'Nouvelle apparence dans « Plus » : Système, Clair ou Sombre',
        'Daylight parle désormais aussi néerlandais, polonais, turc et indonésien',
        'L’année en pixels s’ouvre en plein écran et peut être enregistrée en PNG ou partagée',
        'Dans « À propos », des liens mènent au site web et au code source sur GitHub',
        'Sur tablette, les libellés de la barre d’onglets sont de nouveau bien sous leur icône',
        'Les quantités prennent maintenant la bonne forme grammaticale dans toutes les langues',
      ],
      it: [
        'Quattro widget per la schermata Home: Umore, Cronologia, Serie e Nuova voce, con sfondo e colori regolabili',
        'Nuovo aspetto in “Altro”: Sistema, Chiaro o Scuro',
        'Daylight ora parla anche olandese, polacco, turco e indonesiano',
        'L’anno in pixel si apre a schermo intero e si può salvare come PNG o condividere',
        'In “Informazioni” ci sono i link al sito e al codice sorgente su GitHub',
        'Sui tablet le etichette della barra delle schede tornano ordinate sotto la loro icona',
        'Le quantità ora usano la forma grammaticale giusta in tutte le lingue',
      ],
      nl: [
        'Vier widgets voor het startscherm: Stemming, Verloop, Reeks en Nieuwe registratie, met instelbare achtergrond en kleuren',
        'Nieuwe weergave onder “Meer”: Systeem, Licht of Donker',
        'Daylight is er nu ook in het Nederlands, Pools, Turks en Indonesisch',
        'Het jaar in pixels opent schermvullend en kun je als PNG opslaan of delen',
        'Onder “Over” staan links naar de website en naar de broncode op GitHub',
        'Op tablets staan de labels in de tabbalk weer netjes onder hun icoon',
        'Aantallen staan nu in elke taal in de juiste vorm',
      ],
      pl: [
        'Cztery widżety na ekran główny: Nastrój, Historia, Seria i Nowy wpis, z regulowanym tłem i kolorami',
        'Nowy motyw w „Więcej”: Systemowy, Jasny lub Ciemny',
        'Daylight jest teraz także po niderlandzku, polsku, turecku i indonezyjsku',
        'Rok w pikselach otwiera się na pełnym ekranie i można go zapisać jako PNG lub udostępnić',
        'W „O aplikacji” są linki do strony i do kodu źródłowego na GitHubie',
        'Na tabletach podpisy na pasku kart znów stoją równo pod ikonami',
        'Liczebniki mają teraz we wszystkich językach poprawną formę',
      ],
      tr: [
        'Ana ekran için dört widget: Ruh hali, Geçmiş, Seri ve Yeni kayıt; arka planı ve renkleri ayarlanabilir',
        '“Diğer” altında yeni görünüm ayarı: Sistem, Açık veya Koyu',
        'Daylight artık Felemenkçe, Lehçe, Türkçe ve Endonezce de kullanılabiliyor',
        'Piksellerle yıl tam ekran açılıyor, PNG olarak kaydedilebiliyor veya paylaşılabiliyor',
        '“Hakkında” bölümünde web sitesine ve GitHub\'daki kaynak koda bağlantılar var',
        'Tabletlerde sekme çubuğundaki yazılar yine düzgünce simgelerin altında duruyor',
        'Sayılar artık her dilde doğru dil bilgisi biçimiyle yazılıyor',
      ],
      id: [
        'Empat widget untuk layar utama: Suasana hati, Riwayat, Runtutan, dan Entri baru, dengan latar dan warna yang bisa diatur',
        'Pengaturan tampilan baru di “Lainnya”: Sistem, Terang, atau Gelap',
        'Daylight kini juga tersedia dalam bahasa Belanda, Polandia, Turki, dan Indonesia',
        'Tahun dalam piksel bisa dibuka layar penuh, disimpan sebagai PNG, atau dibagikan',
        'Di “Tentang” ada tautan ke situs web dan ke kode sumber di GitHub',
        'Di tablet, label di bilah tab kembali rapi di bawah ikonnya',
        'Jumlah kini memakai bentuk tata bahasa yang tepat di semua bahasa',
      ],
    },
  },
  {
    version: '1.0.40',
    date: '2026-11-24',
    changes: {
      de: [
        'Nach einer Woche mit Einträgen bittet Daylight auf „Heute“ einmal um eine Bewertung im Play Store',
        'Unter „Mehr“ lässt sich Daylight jederzeit bewerten',
        'Im Eintrag lässt sich der Tag direkt als Wendepunkt markieren',
      ],
      en: [
        'After a week of entries, Daylight asks once on “Today” for a rating on the Play Store',
        'You can rate Daylight any time under “More”',
        'You can mark the day as a turning point right in the entry',
      ],
      es: [
        'Tras una semana de entradas, Daylight pide una vez en «Hoy» una valoración en Play Store',
        'En «Más» puedes valorar Daylight cuando quieras',
        'Desde la entrada puedes marcar el día como punto de inflexión',
      ],
      pt: [
        'Depois de uma semana de registros, o Daylight pede uma vez em “Hoje” uma avaliação na Play Store',
        'Em “Mais” você pode avaliar o Daylight a qualquer momento',
        'No registro você pode marcar o dia como ponto de virada',
      ],
      fr: [
        'Après une semaine d’entrées, Daylight demande une fois dans « Aujourd’hui » une note sur le Play Store',
        'Dans « Plus », tu peux noter Daylight à tout moment',
        'Depuis l’entrée, tu peux marquer le jour comme tournant',
      ],
      it: [
        'Dopo una settimana di voci, Daylight chiede una volta in “Oggi” una recensione sul Play Store',
        'In “Altro” puoi valutare Daylight in qualsiasi momento',
        'Dalla voce puoi segnare il giorno come svolta',
      ],
      nl: [
        'Na een week met registraties vraagt Daylight op “Vandaag” één keer om een beoordeling in de Play Store',
        'Onder “Meer” kun je Daylight op elk moment beoordelen',
        'In de registratie kun je de dag direct als keerpunt markeren',
      ],
      pl: [
        'Po tygodniu z wpisami Daylight jeden raz prosi w zakładce „Dziś” o ocenę w Play Store',
        'W „Więcej” możesz ocenić Daylight w każdej chwili',
        'We wpisie możesz od razu oznaczyć dzień jako punkt zwrotny',
      ],
      tr: [
        'Bir hafta kayıttan sonra Daylight, “Bugün” ekranında bir kez Play Store\'da değerlendirme ister',
        'Daylight\'ı istediğin zaman “Diğer” altından değerlendirebilirsin',
        'Günü doğrudan kayıt içinden dönüm noktası olarak işaretleyebilirsin',
      ],
      id: [
        'Setelah seminggu mencatat, Daylight sekali meminta ulasan di Play Store pada “Hari ini”',
        'Kamu bisa memberi nilai Daylight kapan saja di “Lainnya”',
        'Kamu bisa menandai hari sebagai titik balik langsung di entri',
      ],
    },
  },
  {
    version: '1.0.39',
    date: '2026-11-24',
    changes: {
      de: ['Daylight braucht keine Berechtigung mehr, Netzwerkverbindungen abzurufen'],
      en: ['Daylight no longer needs the permission to view network connections'],
      es: ['Daylight ya no necesita el permiso para ver las conexiones de red'],
      pt: ['O Daylight não precisa mais da permissão para ver as conexões de rede'],
      fr: ['Daylight n’a plus besoin de l’autorisation d’afficher les connexions réseau'],
      it: ['Daylight non ha più bisogno dell’autorizzazione per visualizzare le connessioni di rete'],
      nl: ['Daylight heeft geen toestemming meer nodig om netwerkverbindingen te bekijken'],
      pl: ['Daylight nie potrzebuje już uprawnienia do sprawdzania połączeń sieciowych'],
      tr: ['Daylight artık ağ bağlantılarını görme iznine ihtiyaç duymuyor'],
      id: ['Daylight tidak lagi butuh izin untuk melihat koneksi jaringan'],
    },
  },
  {
    version: '1.0.38',
    date: '2026-11-24',
    changes: {
      de: ['In den „Einblicken“ haben die Karten mehr Abstand zu Zeitraum und Skalenauswahl im festen Kopf'],
      en: ['In “Insights” the cards keep more distance from the period and scale picker in the fixed header'],
      es: ['En «Análisis» las tarjetas dejan más espacio bajo el período y la selección de escala de la cabecera fija'],
      pt: ['Em “Análises” os cartões ficam mais afastados do período e da escolha de escala no cabeçalho fixo'],
      fr: ['Dans « Aperçus », les cartes laissent plus d’espace sous la période et le choix d’échelle de l’en-tête fixe'],
      it: ['In «Analisi» le schede lasciano più spazio sotto il periodo e la scelta della scala nell’intestazione fissa'],
      nl: [
        'In “Inzichten” houden de kaarten meer afstand tot de periode- en schaalkeuze in de vaste kop',
      ],
      pl: ['W „Wgląd” karty mają większy odstęp od wyboru okresu i skali w stałym nagłówku'],
      tr: [
        '“İçgörüler” ekranında kartlar, sabit üst alandaki dönem ve ölçek seçiminden daha fazla aralıklı',
      ],
      id: [
        'Di “Wawasan”, kartu kini berjarak lebih lega dari pilihan periode dan skala di kepala yang tetap',
      ],
    },
  },
  {
    version: '1.0.37',
    date: '2026-11-24',
    changes: {
      de: [
        'Unter „Skalen“ wählst du die Skala oben im festen Kopf oder per Tipp auf ihre Kachel, und jede Karte nennt die gewählte Skala',
        'Karten zu Gesundheit und Gruppen nennen im Titel, was sie gerade zeigen, und Durchschnitte tragen ein Ø',
        'Kam abends der Hinweis auf einen guten Tag, steht er am Morgen als „Gute Aussichten für heute“ auf „Heute“',
        'Unter „Ausblick“ kannst du dir dafür morgens eine Benachrichtigung schicken lassen, die nichts verrät',
      ],
      en: [
        'Under “Scales” you pick the scale in the fixed header or by tapping its tile, and every card names the chosen scale',
        'Health and group cards name in their title what they show, and averages are marked as such',
        'If the hint about a good day came in the evening, “Today” shows it in the morning as “Good prospects for today”',
        'Under “Outlook” you can get a morning notification for it that gives nothing away',
      ],
      es: [
        'En «Escalas» eliges la escala en la cabecera fija o tocando su ficha, y cada tarjeta nombra la escala elegida',
        'Las tarjetas de salud y de grupos dicen en el título lo que muestran, y los promedios van marcados',
        'Si por la noche llegó el aviso de un buen día, «Hoy» lo muestra por la mañana como «Buenas perspectivas para hoy»',
        'En «Previsión» puedes recibir para ello un aviso por la mañana que no revela nada',
      ],
      pt: [
        'Em “Escalas” você escolhe a escala no cabeçalho fixo ou tocando no cartão dela, e cada cartão mostra a escala escolhida',
        'Os cartões de saúde e de grupos dizem no título o que mostram, e as médias vêm indicadas',
        'Se à noite veio o aviso de um bom dia, “Hoje” o mostra de manhã como “Boas perspectivas para hoje”',
        'Em “Previsão” você pode receber uma notificação de manhã para isso, sem revelar nada',
      ],
      fr: [
        'Dans « Échelles », tu choisis l’échelle dans l’en-tête fixe ou en touchant sa tuile, et chaque carte nomme l’échelle choisie',
        'Les cartes santé et groupes disent dans leur titre ce qu’elles montrent, et les moyennes sont signalées',
        'Si l’indication d’une bonne journée est venue le soir, « Aujourd’hui » l’affiche le matin sous « De belles perspectives pour aujourd’hui »',
        'Dans « Prévision », tu peux recevoir pour cela une notification le matin qui ne dévoile rien',
      ],
      it: [
        'In “Scale” scegli la scala nell’intestazione fissa o toccando la sua scheda, e ogni scheda indica la scala scelta',
        'Le schede su salute e gruppi dicono nel titolo cosa mostrano, e le medie sono segnalate',
        'Se la sera è arrivato l’avviso di una bella giornata, “Oggi” lo mostra al mattino come “Buone prospettive per oggi”',
        'In “Previsione” puoi ricevere una notifica al mattino che non rivela nulla',
      ],
      nl: [
        'Onder “Schalen” kies je de schaal bovenaan in de vaste kop of met een tik op de tegel, en elke kaart noemt de gekozen schaal',
        'Kaarten over gezondheid en groepen noemen in hun titel wat ze tonen, en gemiddelden zijn als zodanig gemarkeerd',
        'Kwam de hint over een goede dag \'s avonds, dan staat hij \'s ochtends als “Goede vooruitzichten voor vandaag” op “Vandaag”',
        'Onder “Vooruitblik” kun je daarvoor \'s ochtends een melding krijgen die niets verraadt',
      ],
      pl: [
        'W „Skale” wybierasz skalę w stałym nagłówku lub stuknięciem w jej kafelek, a każda karta podaje wybraną skalę',
        'Karty zdrowia i grup podają w tytule, co pokazują, a średnie są oznaczone jako średnie',
        'Jeśli wskazówka na dobry dzień pojawiła się wieczorem, rano zakładka „Dziś” pokazuje ją jako „Dobre widoki na dziś”',
        'W „Prognoza” możesz włączyć poranne powiadomienie o tym, które niczego nie zdradza',
      ],
      tr: [
        '“Ölçekler” altında ölçeği sabit üst alandan ya da kutucuğuna dokunarak seçersin, her kart seçili ölçeği belirtir',
        'Sağlık ve grup kartları başlıklarında neyi gösterdiklerini belirtir, ortalamalar da öyle işaretlenir',
        'İyi bir güne dair ipucu akşam geldiyse, “Bugün” onu sabah “Bugün için iyi beklentiler” olarak gösterir',
        '“Öngörü” altında bunun için hiçbir şey ele vermeyen bir sabah bildirimi alabilirsin',
      ],
      id: [
        'Di “Skala”, kamu memilih skala di kepala yang tetap atau dengan mengetuk kotaknya, dan setiap kartu menyebut skala yang dipilih',
        'Kartu kesehatan dan grup menyebut di judulnya apa yang sedang ditampilkan, dan rata-rata ditandai dengan jelas',
        'Jika petunjuk tentang hari yang baik muncul di malam hari, “Hari ini” menampilkannya di pagi hari sebagai “Prospek baik untuk hari ini”',
        'Di “Perkiraan”, kamu bisa mendapat notifikasi pagi untuk itu yang tidak membocorkan apa pun',
      ],
    },
  },
  {
    version: '1.0.36',
    date: '2026-11-24',
    changes: {
      de: [
        'Die neue Karte „Trends“ unter „Einblicke“ zeigt, wohin sich Stimmung, Skalen, Schlaf und Schritte in den letzten Wochen bewegen',
        'Ein kleiner Pfeil im Tagesstreifen markiert den Tag, der gut werden könnte',
        'Der Hinweis auf einen guten nächsten Tag ist klarer formuliert',
      ],
      en: [
        'The new “Trends” card under “Insights” shows where mood, scales, sleep and steps have been heading in recent weeks',
        'A small arrow in the day strip marks the day that could turn out well',
        'The hint about a good next day is worded more clearly',
      ],
      es: [
        'La nueva tarjeta «Tendencias» en «Análisis» muestra hacia dónde van el ánimo, las escalas, el sueño y los pasos en las últimas semanas',
        'Una pequeña flecha en la tira de días marca el día que podría salir bien',
        'El aviso de un buen día siguiente está redactado con más claridad',
      ],
      pt: [
        'O novo cartão “Tendências” em “Análises” mostra para onde humor, escalas, sono e passos estão indo nas últimas semanas',
        'Uma pequena seta na faixa de dias marca o dia que pode ser bom',
        'O aviso de um bom dia seguinte está escrito de forma mais clara',
      ],
      fr: [
        'La nouvelle carte « Tendances » dans « Aperçus » montre où vont l’humeur, les échelles, le sommeil et les pas ces dernières semaines',
        'Une petite flèche dans la bande des jours marque le jour qui pourrait être bon',
        'L’indication d’un bon lendemain est formulée plus clairement',
      ],
      it: [
        'La nuova scheda “Tendenze” in “Analisi” mostra dove vanno umore, scale, sonno e passi nelle ultime settimane',
        'Una piccola freccia nella striscia dei giorni segna il giorno che potrebbe andare bene',
        'L’avviso di un buon giorno successivo è formulato in modo più chiaro',
      ],
      nl: [
        'De nieuwe kaart “Trends” onder “Inzichten” toont waar stemming, schalen, slaap en stappen de laatste weken naartoe gaan',
        'Een klein pijltje in de dagstrook markeert de dag die goed kan worden',
        'De hint over een goede volgende dag is duidelijker verwoord',
      ],
      pl: [
        'Nowa karta „Tendencje” w „Wgląd” pokazuje, w którą stronę zmieniały się w ostatnich tygodniach nastrój, skale, sen i kroki',
        'Mała strzałka na pasku dni oznacza dzień, który może być dobry',
        'Wskazówka na dobry następny dzień jest sformułowana jaśniej',
      ],
      tr: [
        '“İçgörüler” altındaki yeni “Eğilimler” kartı, ruh hali, ölçekler, uyku ve adımların son haftalarda nereye gittiğini gösterir',
        'Gün şeridindeki küçük bir ok, iyi geçebilecek günü işaretler',
        'İyi bir sonraki güne dair ipucu daha anlaşılır yazıldı',
      ],
      id: [
        'Kartu baru “Tren” di “Wawasan” menunjukkan ke mana arah suasana hati, skala, tidur, dan langkah dalam beberapa minggu terakhir',
        'Panah kecil di strip hari menandai hari yang bisa jadi baik',
        'Petunjuk tentang hari berikutnya yang baik kini dirumuskan lebih jelas',
      ],
    },
  },
  {
    version: '1.0.35',
    date: '2026-11-23',
    changes: {
      de: [
        'Unter „Zusammenhänge“ siehst du, wie deine Skalen mit Stimmung, untereinander und mit deinem Körper zusammenhängen',
        'Nach deinem Eintrag zeigt „Heute“ ab und zu, wenn der nächste Tag bessere Chancen als sonst hat, gut zu werden',
        'Die Seite „Ausblick“ erklärt, wann dieser Hinweis kommt und wie oft er bisher zutraf',
      ],
      en: [
        'Under “Connections” you can see how your scales relate to mood, to each other and to your body',
        'After your entry, “Today” now and then shows when the next day has a better chance than usual to be good',
        'The “Outlook” page explains when this hint appears and how often it held so far',
      ],
      es: [
        'En «Relaciones» ves cómo se relacionan tus escalas con el ánimo, entre sí y con tu cuerpo',
        'Tras tu entrada, «Hoy» muestra de vez en cuando si el día siguiente tiene más probabilidades de ser bueno',
        'La página «Previsión» explica cuándo aparece este aviso y cuánto ha acertado',
      ],
      pt: [
        'Em “Relações” você vê como suas escalas se relacionam com o humor, entre si e com seu corpo',
        'Depois do seu registro, “Hoje” mostra de vez em quando se o dia seguinte tem mais chance de ser bom',
        'A página “Previsão” explica quando esse aviso aparece e quanto ele acertou até agora',
      ],
      fr: [
        'Dans « Liens », tu vois comment tes échelles se relient à l’humeur, entre elles et à ton corps',
        'Après ton entrée, « Aujourd’hui » indique parfois quand le lendemain a plus de chances d’être bon',
        'La page « Prévision » explique quand cet indice apparaît et à quel point il s’est vérifié',
      ],
      it: [
        'In «Relazioni» vedi come le tue scale si collegano all’umore, tra loro e al tuo corpo',
        'Dopo la tua voce, «Oggi» mostra ogni tanto se il giorno dopo ha più probabilità di essere buono',
        'La pagina «Previsione» spiega quando compare questo avviso e quanto ha indovinato finora',
      ],
      nl: [
        'Onder “Verbanden” zie je hoe je schalen samenhangen met je stemming, met elkaar en met je lichaam',
        'Na je registratie toont “Vandaag” af en toe wanneer de volgende dag een grotere kans dan gewoonlijk heeft om goed te worden',
        'De pagina “Vooruitblik” legt uit wanneer deze hint komt en hoe vaak hij tot nu toe klopte',
      ],
      pl: [
        'W „Powiązania” widzisz, jak Twoje skale wiążą się z nastrojem, ze sobą nawzajem i z Twoim ciałem',
        'Po Twoim wpisie zakładka „Dziś” od czasu do czasu pokazuje, że następny dzień ma większą niż zwykle szansę być dobry',
        'Strona „Prognoza” wyjaśnia, kiedy pojawia się ta wskazówka i jak często się dotąd sprawdzała',
      ],
      tr: [
        '“Bağlantılar” altında ölçeklerinin ruh haliyle, birbiriyle ve bedeninle nasıl ilişkili olduğunu görürsün',
        'Kaydından sonra “Bugün”, ertesi günün iyi geçme şansı normalden yüksekse zaman zaman bunu gösterir',
        '“Öngörü” sayfası bu ipucunun ne zaman geldiğini ve şimdiye kadar ne sıklıkla tuttuğunu açıklar',
      ],
      id: [
        'Di “Hubungan”, kamu bisa melihat bagaimana skalamu berkaitan dengan suasana hati, satu sama lain, dan tubuhmu',
        'Setelah kamu mencatat, “Hari ini” sesekali menunjukkan saat hari berikutnya punya peluang lebih baik dari biasanya untuk menjadi hari yang baik',
        'Halaman “Perkiraan” menjelaskan kapan petunjuk ini muncul dan seberapa sering petunjuk itu tepat sejauh ini',
      ],
    },
  },
  {
    version: '1.0.34',
    date: '2026-11-23',
    changes: {
      de: [
        'Die Einblicke haben einen eigenen Bereich „Skalen“ mit Verlauf, Wochentagen und der Stimmung je Wert',
        'Dort steht auch, welche Aktivitäten mit höheren oder niedrigeren Werten einhergehen und wie sich gute und schwierige Tage unterscheiden',
        'Die Seiten zu Aktivitäten und Stimmungen vergleichen deine Skalen mit den übrigen Tagen',
        'Eine neue Skala kann eine Dauer in Stunden und Minuten erfassen, etwa für Arbeit oder Lesen',
        'Unten im Eintrag führen zwei Zeilen direkt zu Aktivitäten und Skalen',
      ],
      en: [
        'Insights have their own “Scales” section with the course over time, weekdays and the mood for each value',
        'It also shows which activities go with higher or lower values and how good and hard days differ',
        'The pages for activities and moods compare your scales with all other days',
        'A new scale can record a duration in hours and minutes, for work or reading for example',
        'At the bottom of an entry, two rows lead straight to activities and scales',
      ],
      es: [
        'Los análisis tienen una sección «Escalas» con evolución, días de la semana y ánimo por valor',
        'Muestra qué actividades van con valores altos o bajos y cómo difieren los días buenos y difíciles',
        'Las páginas de actividades y estados de ánimo comparan tus escalas con el resto de días',
        'Una escala nueva puede registrar una duración en horas y minutos',
        'Al final de cada entrada, dos filas llevan directamente a actividades y escalas',
      ],
      pt: [
        'As análises têm uma seção própria “Escalas” com a evolução, os dias da semana e o humor para cada valor',
        'Lá também aparece quais atividades combinam com valores mais altos ou mais baixos e como os dias bons e difíceis se diferenciam',
        'As páginas de atividades e humores comparam suas escalas com os demais dias',
        'Uma escala nova pode registrar uma duração em horas e minutos, por exemplo para trabalho ou leitura',
        'No fim de cada registro, duas linhas levam direto para atividades e escalas',
      ],
      fr: [
        'Les aperçus ont une section « Échelles » avec l’évolution, les jours et l’humeur par valeur',
        'Elle montre les activités liées aux valeurs hautes ou basses et l’écart entre bons et mauvais jours',
        'Les pages des activités et des humeurs comparent tes échelles avec les autres jours',
        'Une nouvelle échelle peut enregistrer une durée en heures et minutes',
        'En bas d’une entrée, deux lignes mènent directement aux activités et aux échelles',
      ],
      it: [
        'Le analisi hanno una sezione propria «Scale» con l’andamento, i giorni della settimana e l’umore per ogni valore',
        'Lì si vede anche quali attività vanno con valori più alti o più bassi e in cosa differiscono i giorni buoni e difficili',
        'Le pagine di attività e umori confrontano le tue scale con gli altri giorni',
        'Una nuova scala può registrare una durata in ore e minuti, per esempio per il lavoro o la lettura',
        'In fondo a una voce, due righe portano direttamente ad attività e scale',
      ],
      nl: [
        'De inzichten hebben een eigen onderdeel “Schalen” met verloop, weekdagen en de stemming per waarde',
        'Daar staat ook welke activiteiten samengaan met hogere of lagere waarden en hoe goede en zware dagen verschillen',
        'De pagina\'s over activiteiten en stemmingen vergelijken je schalen met de overige dagen',
        'Een nieuwe schaal kan een duur in uren en minuten bijhouden, bijvoorbeeld voor werk of lezen',
        'Onderaan in de registratie leiden twee regels direct naar activiteiten en schalen',
      ],
      pl: [
        'Wgląd ma własną sekcję „Skale” z przebiegiem, dniami tygodnia i nastrojem dla każdej wartości',
        'Widać tam też, które aktywności idą w parze z wyższymi lub niższymi wartościami i czym różnią się dobre i trudne dni',
        'Strony aktywności i nastrojów porównują Twoje skale z pozostałymi dniami',
        'Nowa skala może zapisywać czas trwania w godzinach i minutach, na przykład pracy lub czytania',
        'Na dole wpisu dwa wiersze prowadzą prosto do aktywności i skal',
      ],
      tr: [
        'İçgörülerde seyir, haftanın günleri ve her değere göre ruh haliyle ayrı bir “Ölçekler” bölümü var',
        'Orada hangi aktivitelerin daha yüksek ya da düşük değerlerle birlikte geldiği ve iyi ile zor günlerin nasıl ayrıştığı da görünür',
        'Aktivite ve ruh hali sayfaları ölçeklerini diğer tüm günlerle karşılaştırır',
        'Yeni bir ölçek saat ve dakika olarak bir süre kaydedebilir, örneğin iş ya da okuma için',
        'Kaydın altındaki iki satır doğrudan aktivitelere ve ölçeklere götürür',
      ],
      id: [
        'Wawasan punya bagian “Skala” sendiri dengan perkembangan dari waktu ke waktu, hari dalam seminggu, dan suasana hati untuk setiap nilai',
        'Di sana juga terlihat aktivitas mana yang menyertai nilai lebih tinggi atau lebih rendah dan bagaimana hari baik dan hari berat berbeda',
        'Halaman aktivitas dan suasana hati membandingkan skalamu dengan hari-hari lainnya',
        'Skala baru bisa mencatat durasi dalam jam dan menit, misalnya untuk kerja atau membaca',
        'Di bagian bawah entri, dua baris langsung menuju aktivitas dan skala',
      ],
    },
  },
  {
    version: '1.0.33',
    date: '2026-11-17',
    changes: {
      de: [
        'Hintergrund und App-Symbol wechseln mit den Jahreszeiten und zu Festen wie Weihnachten oder Silvester',
        'Unter „Mehr“ lassen sich „Design zur Jahreszeit“ und „Designs zu Festen“ ausschalten',
        'Die tägliche Erinnerung kommt auf Wunsch jeden Abend, auch wenn der Tag schon einen Eintrag hat',
        'Unten im Eintrag führt ein kleiner Hinweis zu eigenen Skalen, Aktivitäten und Gruppen',
        'Die Erfolge zeigen den Weg zum nächsten Stern kurz als Bruch, etwa 27/30',
      ],
      en: [
        'The background and app icon change with the seasons and for holidays like Christmas or New Year’s Eve',
        'Under “More” you can turn off “Seasonal design” and “Festival designs”',
        'If you like, the daily reminder comes every evening, even when the day already has an entry',
        'A small note at the bottom of an entry leads to your own scales, activities and groups',
        'Awards show the way to the next star as a short fraction, like 27/30',
      ],
      es: [
        'El fondo y el icono de la app cambian con las estaciones y en fiestas como Navidad o Nochevieja',
        'En “Más” puedes desactivar “Diseño de temporada” y “Diseños de fiestas”',
        'Si quieres, el recordatorio diario llega cada tarde, aunque el día ya tenga una entrada',
        'Una pequeña nota al final de la entrada lleva a tus propias escalas, actividades y grupos',
        'Los logros muestran lo que falta para la siguiente estrella como fracción, por ejemplo 27/30',
      ],
      pt: [
        'O fundo e o ícone do app mudam com as estações e em datas como Natal ou Réveillon',
        'Em “Mais” dá para desligar “Design da estação” e “Designs de datas festivas”',
        'Se quiser, o lembrete diário aparece toda noite, mesmo quando o dia já tem um registro',
        'Uma pequena dica no fim do registro leva às suas próprias escalas, atividades e grupos',
        'As conquistas mostram o caminho até a próxima estrela como fração, por exemplo 27/30',
      ],
      fr: [
        'Le fond et l’icône de l’app changent avec les saisons et pour des fêtes comme Noël ou le Nouvel An',
        'Dans « Plus », tu peux désactiver « Design de saison » et « Designs des fêtes »',
        'Si tu veux, le rappel quotidien arrive chaque soir, même si la journée a déjà une entrée',
        'Une petite note en bas de l’entrée mène à tes propres échelles, activités et groupes',
        'Les succès affichent le chemin vers la prochaine étoile sous forme de fraction, comme 27/30',
      ],
      it: [
        'Lo sfondo e l’icona dell’app cambiano con le stagioni e per feste come Natale o Capodanno',
        'In “Altro” puoi disattivare “Design di stagione” e “Design delle feste”',
        'Se vuoi, il promemoria giornaliero arriva ogni sera, anche se il giorno ha già una voce',
        'Una piccola nota in fondo alla voce porta alle tue scale, attività e gruppi',
        'I traguardi mostrano quanto manca alla prossima stella come frazione, ad esempio 27/30',
      ],
      nl: [
        'Achtergrond en app-icoon wisselen met de seizoenen en bij feestdagen zoals Kerstmis of oudejaarsavond',
        'Onder “Meer” kun je “Seizoensdesign” en “Feestdagdesigns” uitzetten',
        'De dagelijkse herinnering komt als je wilt elke avond, ook als de dag al een registratie heeft',
        'Onderaan in de registratie leidt een kleine hint naar je eigen schalen, activiteiten en groepen',
        'De beloningen tonen de weg naar de volgende ster kort als breuk, bijvoorbeeld 27/30',
      ],
      pl: [
        'Tło i ikona aplikacji zmieniają się z porami roku i na święta, takie jak Boże Narodzenie czy sylwester',
        'W „Więcej” można wyłączyć „Wygląd sezonowy” i „Wygląd świąteczny”',
        'Jeśli chcesz, codzienne przypomnienie przychodzi każdego wieczoru, nawet gdy dzień ma już wpis',
        'Mała wskazówka na dole wpisu prowadzi do własnych skal, aktywności i grup',
        'Nagrody pokazują drogę do następnej gwiazdki krótko jako ułamek, na przykład 27/30',
      ],
      tr: [
        'Arka plan ve uygulama simgesi mevsimlerle ve Noel ya da yılbaşı gecesi gibi özel günlerde değişir',
        '“Diğer” altında “Mevsim tasarımı” ve “Özel gün tasarımları” kapatılabilir',
        'Günlük hatırlatıcı istersen, günün zaten bir kaydı olsa bile her akşam gelir',
        'Kaydın altındaki küçük bir not kendi ölçeklerine, aktivitelerine ve gruplarına götürür',
        'Ödüller sonraki yıldıza giden yolu 27/30 gibi kısa bir kesirle gösterir',
      ],
      id: [
        'Latar belakang dan ikon aplikasi berganti mengikuti musim dan hari raya seperti Natal atau malam Tahun Baru',
        'Di “Lainnya”, kamu bisa mematikan “Tampilan musiman” dan “Tampilan hari raya”',
        'Jika kamu mau, pengingat harian muncul setiap malam, meski hari itu sudah ada entri',
        'Catatan kecil di bagian bawah entri menuju skala, aktivitas, dan grup buatanmu sendiri',
        'Penghargaan menunjukkan jarak ke bintang berikutnya sebagai pecahan singkat, misalnya 27/30',
      ],
    },
  },
  {
    version: '1.0.32',
    date: '2026-10-25',
    changes: {
      de: ['Das App-Symbol trägt im Herbst Laub und Herbstfarben'],
      en: ['The app icon wears autumn leaves and colours for the season'],
      es: ['El icono de la app lleva hojas y colores de otoño'],
      pt: ['O ícone do app ganhou folhas e cores de outono'],
      fr: ['L\'icône de l\'app se pare de feuilles et de couleurs d\'automne'],
      it: ['L\'icona dell\'app si veste di foglie e colori autunnali'],
      nl: ['Het app-icoon draagt in de herfst bladeren en herfstkleuren'],
      pl: ['Jesienią ikona aplikacji nosi liście i jesienne kolory'],
      tr: ['Uygulama simgesi sonbaharda yapraklar ve sonbahar renkleriyle süslenir'],
      id: ['Ikon aplikasi memakai daun dan warna musim gugur'],
    },
  },
  {
    version: '1.0.31',
    date: '2026-10-25',
    changes: {
      de: [
        'Unter „Erfolge“ stehen die Erfolge, deren nächster Stern am nächsten ist, jetzt oben',
        'Der Pokal unter „Erfolge“ springt beim Öffnen ruhiger herein',
      ],
      en: [
        'Under “Awards” the awards whose next star is closest now come first',
        'The trophy under “Awards” appears more calmly when the page opens',
      ],
      es: [
        'En “Logros” aparecen primero los logros cuya próxima estrella está más cerca',
        'El trofeo de “Logros” aparece con más calma al abrir la página',
      ],
      pt: [
        'Em “Conquistas” aparecem primeiro as conquistas cuja próxima estrela está mais perto',
        'O troféu de “Conquistas” aparece com mais calma ao abrir a página',
      ],
      fr: [
        'Dans « Succès », les succès dont la prochaine étoile est la plus proche apparaissent en premier',
        'Le trophée de « Succès » apparaît plus calmement à l\'ouverture de la page',
      ],
      it: [
        'In “Traguardi” compaiono per primi i traguardi con la prossima stella più vicina',
        'Il trofeo di “Traguardi” appare con più calma quando si apre la pagina',
      ],
      nl: [
        'Onder “Beloningen” staan de beloningen waarvan de volgende ster het dichtstbij is nu bovenaan',
        'De beker onder “Beloningen” verschijnt rustiger bij het openen',
      ],
      pl: [
        'W „Nagrody” na górze są teraz nagrody, którym najmniej brakuje do następnej gwiazdki',
        'Puchar w „Nagrody” pojawia się spokojniej przy otwieraniu',
      ],
      tr: [
        '“Ödüller” altında sonraki yıldızı en yakın olan ödüller artık en üstte',
        '“Ödüller” altındaki kupa, sayfa açılırken daha sakin beliriyor',
      ],
      id: [
        'Di “Penghargaan”, penghargaan yang bintang berikutnya paling dekat kini ada di atas',
        'Piala di “Penghargaan” muncul lebih tenang saat halaman dibuka',
      ],
    },
  },
  {
    version: '1.0.30',
    date: '2026-10-25',
    changes: {
      de: [
        'Jeder Erfolg zeigt groß, wie viel bis zum nächsten Stern noch fehlt',
        'Unter „Erfolge“ steht oben, welcher Stern als Nächstes in Reichweite ist, ein Tipp springt hin',
        'Die Seite „Erfolge“ ist bunter, mit Pokal, goldenem Fortschrittsbalken und Sternen je Bereich',
      ],
      en: [
        'Every award shows in large numbers how much is still missing for the next star',
        'The top of “Awards” shows the next star within reach, a tap jumps to it',
        'The “Awards” page is more colourful, with a trophy, a golden progress bar and stars per section',
      ],
      es: [
        'Cada logro muestra en grande cuánto falta para la próxima estrella',
        'Arriba en “Logros” aparece la próxima estrella a tu alcance, un toque te lleva a ella',
        'La página “Logros” tiene más color, con trofeo, barra de progreso dorada y estrellas por sección',
      ],
      pt: [
        'Cada conquista mostra em destaque quanto falta para a próxima estrela',
        'No topo de “Conquistas” aparece a próxima estrela ao seu alcance, um toque leva até ela',
        'A página “Conquistas” ficou mais colorida, com troféu, barra de progresso dourada e estrelas por seção',
      ],
      fr: [
        'Chaque succès affiche en grand ce qu’il manque pour la prochaine étoile',
        'En haut de « Succès », la prochaine étoile à portée de main s’affiche, un appui y mène',
        'La page « Succès » est plus colorée, avec un trophée, une barre de progression dorée et les étoiles par section',
      ],
      it: [
        'Ogni traguardo mostra in grande quanto manca alla prossima stella',
        'In cima a “Traguardi” compare la prossima stella a portata di mano, un tocco ti ci porta',
        'La pagina “Traguardi” è più colorata, con trofeo, barra di avanzamento dorata e stelle per sezione',
      ],
      nl: [
        'Elke beloning toont groot hoeveel er nog ontbreekt tot de volgende ster',
        'Bovenaan bij “Beloningen” staat welke ster als volgende binnen bereik is, een tik springt ernaartoe',
        'De pagina “Beloningen” is kleurrijker, met een beker, een gouden voortgangsbalk en sterren per onderdeel',
      ],
      pl: [
        'Każda nagroda pokazuje dużymi cyframi, ile jeszcze brakuje do następnej gwiazdki',
        'Na górze „Nagrody” widać, która gwiazdka jest najbliżej, a stuknięcie do niej przenosi',
        'Strona „Nagrody” jest bardziej kolorowa, z pucharem, złotym paskiem postępu i gwiazdkami dla każdej sekcji',
      ],
      tr: [
        'Her ödül, sonraki yıldıza ne kadar kaldığını büyük rakamlarla gösterir',
        '“Ödüller” sayfasının üstü ulaşılabilecek sonraki yıldızı gösterir, bir dokunuş oraya götürür',
        '“Ödüller” sayfası daha renkli: kupa, altın renkli ilerleme çubuğu ve her bölüm için yıldızlar',
      ],
      id: [
        'Setiap penghargaan menunjukkan dengan angka besar berapa yang masih kurang untuk bintang berikutnya',
        'Bagian atas “Penghargaan” menunjukkan bintang berikutnya yang sudah dekat, satu ketukan langsung menuju ke sana',
        'Halaman “Penghargaan” lebih berwarna, dengan piala, bilah kemajuan emas, dan bintang per bagian',
      ],
    },
  },
  {
    version: '1.0.29',
    date: '2026-10-16',
    changes: {
      de: [
        'Daylight gibt es jetzt auch auf Spanisch, Portugiesisch, Französisch und Italienisch, umschalten lässt sich unter „Mehr“ bei „Sprache“',
        'Der Hinweis „Reden hilft“ nennt die Krisenhotline deines Landes statt immer die deutsche',
        'Kurze Beschriftungen wie Wochentage werden nicht mehr abgeschnitten',
      ],
      en: [
        'Daylight is now also available in Spanish, Portuguese, French and Italian, switch under “More” at “Language”',
        'The “Talking helps” note names the crisis line of your country instead of always the German one',
        'Short labels like weekdays are no longer cut off',
      ],
      es: [
        'Daylight ya está disponible en español, portugués, francés e italiano, cámbialo en “Más”, apartado “Idioma”',
        'El aviso “Hablar ayuda” muestra la línea de crisis de tu país en lugar de siempre la alemana',
        'Las etiquetas cortas, como los días de la semana, ya no se cortan',
      ],
      pt: [
        'O Daylight agora também está em espanhol, português, francês e italiano, troque em “Mais”, na seção “Idioma”',
        'O aviso “Conversar ajuda” mostra a linha de apoio do seu país em vez de sempre a alemã',
        'Rótulos curtos, como os dias da semana, não aparecem mais cortados',
      ],
      fr: [
        'Daylight existe maintenant aussi en espagnol, portugais, français et italien, à choisir dans « Plus », rubrique « Langue »',
        'La remarque « Parler aide » indique la ligne d\'écoute de ton pays au lieu de toujours celle d\'Allemagne',
        'Les libellés courts comme les jours de la semaine ne sont plus coupés',
      ],
      it: [
        'Daylight ora è disponibile anche in spagnolo, portoghese, francese e italiano, cambia lingua in “Altro” alla voce “Lingua”',
        'L\'avviso “Parlarne aiuta” indica la linea di ascolto del tuo paese invece di quella tedesca',
        'Le etichette brevi come i giorni della settimana non vengono più tagliate',
      ],
      nl: [
        'Daylight is nu ook beschikbaar in het Spaans, Portugees, Frans en Italiaans, wisselen kan onder “Meer” bij “Taal”',
        'De hint “Praten helpt” noemt de hulplijn van jouw land in plaats van altijd de Duitse',
        'Korte labels zoals weekdagen worden niet meer afgekapt',
      ],
      pl: [
        'Daylight jest teraz dostępny także po hiszpańsku, portugalsku, francusku i włosku, język zmienisz w „Więcej” w sekcji „Język”',
        'Informacja „Rozmowa pomaga” podaje telefon wsparcia w Twoim kraju zamiast zawsze niemieckiego',
        'Krótkie etykiety, takie jak dni tygodnia, nie są już ucinane',
      ],
      tr: [
        'Daylight artık İspanyolca, Portekizce, Fransızca ve İtalyanca olarak da kullanılabilir, “Diğer” altında “Dil” bölümünden değiştirebilirsin',
        '“Konuşmak iyi gelir” notu her zaman Almanya\'dakini değil, ülkendeki kriz hattını gösterir',
        'Haftanın günleri gibi kısa etiketler artık kesilmiyor',
      ],
      id: [
        'Daylight kini juga tersedia dalam bahasa Spanyol, Portugis, Prancis, dan Italia, ganti di “Lainnya” pada “Bahasa”',
        'Pesan “Bercerita bisa membantu” menyebut layanan krisis di negaramu, tidak lagi selalu layanan Jerman',
        'Label pendek seperti nama hari tidak lagi terpotong',
      ],
    },
  },
  {
    version: '1.0.28',
    date: '2026-10-15',
    changes: {
      de: ['Beim Einrichten eines neuen Handys kopiert Android dein Tagebuch nicht mehr mit, es zieht nur über deine eigene Sicherung um'],
      en: ['When you set up a new phone, Android no longer copies your journal, it only moves over with your own backup'],
    },
  },
  {
    version: '1.0.27',
    date: '2026-10-15',
    changes: {
      de: [
        'Doppeltes Tippen auf Speichern legt keinen Eintrag mehr doppelt an, und angefangene Einträge gehen nicht mehr verloren',
        'Der Import ordnet eigene Stimmungen richtig zu und behält Einträge, die nur ähnlich aussehen',
        'Schritte und Training von heute zählen in den Auswertungen erst, wenn der Tag vorbei ist',
        'Erinnerungen kommen nach einem Wechsel der Zeitzone zur richtigen Uhrzeit',
        'Die App-Sperre fragt nach Fotoauswahl, Teilen oder Berechtigungen nicht mehr erneut',
      ],
      en: [
        'Tapping Save twice no longer creates a duplicate entry, and unfinished entries are no longer lost',
        'Import maps your own moods correctly and keeps entries that only look alike',
        'Today\'s steps and exercise count in Insights only once the day is over',
        'Reminders arrive at the right time after a time zone change',
        'The app lock no longer asks again after picking a photo, sharing or granting a permission',
      ],
    },
  },
  {
    version: '1.0.26',
    date: '2026-10-13',
    changes: {
      de: [
        '„Heute“ zeigt, wie viele Tage in Folge du einträgst, und feiert alle 10, 50 und 200 Tage',
        'Fehlt ein Tag, holt Nachtragen deine Serie zurück, eine Karte führt durch die fehlenden Tage',
        'Fehlt gestern noch ein Eintrag, erinnert dich die App am nächsten Morgen, ein Tipp darauf öffnet gleich den richtigen Tag',
        'Beim ersten Start fragt die App, ob sie dich abends erinnern soll',
        'Ein Tipp auf einen neuen Erfolg springt direkt zu seiner Karte',
      ],
      en: [
        'Today shows how many days in a row you have logged and celebrates every 10, 50 and 200 days',
        'If a day is missing, filling it in brings your streak back, and a card walks you through the missing days',
        'If yesterday has no entry yet, the app reminds you the next morning, and tapping the reminder opens the right day',
        'On first launch the app asks whether it should remind you in the evening',
        'Tapping a new award jumps straight to its card',
      ],
    },
  },
  {
    version: '1.0.25',
    date: '2026-10-08',
    changes: {
      de: [
        'Nach einem Sprachwechsel zeigen Tagesstreifen und Datum unter „Heute“ sofort die neue Sprache',
        'Die App ist deutlich kleiner und braucht weniger Speicher',
      ],
      en: [
        'After switching the language, the day strip and date on Today show the new language right away',
        'The app is noticeably smaller and takes up less storage',
      ],
    },
  },
  {
    version: '1.0.24',
    date: '2026-10-07',
    changes: {
      de: [
        'Wendepunkte: Markiere bis zu vier Tage im Jahr, die etwas verändert haben, und vergleiche die Zeit davor mit der danach',
        'Wendepunkte stehen im Verlauf, als Fähnchen im Kalender und als Linie im Stimmungsverlauf',
        'Neuer Erfolg für Wendepunkte, und die Stufen bei den Wörtern in sieben Tagen sind leichter erreichbar',
      ],
      en: [
        'Turning points: mark up to four days a year that changed something and compare the time before with the time after',
        'Turning points show up in History, as a flag in the calendar and as a line in the mood chart',
        'New award for turning points, and the tiers for words in seven days are easier to reach',
      ],
    },
  },
  {
    version: '1.0.23',
    date: '2026-10-03',
    changes: {
      de: [
        'Neuer Tab Erfolge mit Sternen fürs Dranbleiben, von Bronze bis zum schimmernden fünften Stern',
        'Neue Sterne meldet eine kurze Nachricht oben, ein Tipp öffnet die Erfolge',
        'Der Verlauf ist jetzt unter Mehr zu finden',
        'Gesundheitsdaten können auf Wunsch mit in die Sicherung',
      ],
      en: [
        'New Awards tab with stars for keeping at it, from bronze to a shimmering fifth star',
        'A short message at the top announces new stars, a tap opens Awards',
        'History now lives under More',
        'Health data can go into the backup if you want',
      ],
    },
  },
  {
    version: '1.0.22',
    date: '2026-10-03',
    changes: {
      de: ['Kleinere Korrekturen im Hintergrund'],
      en: ['Minor fixes in the background'],
    },
  },
  {
    version: '1.0.21',
    date: '2026-10-03',
    changes: {
      de: ['Überarbeitete Texte in der Updatehistorie'],
      en: ['Revised wording in the update history'],
    },
  },
  {
    version: '1.0.20',
    date: '2026-10-03',
    changes: {
      de: ['Beim ersten Start bringt jede Gruppe schon ein paar Aktivitäten mit, auf Deutsch oder Englisch'],
      en: ['On first start, every group already comes with a few activities, in English or German'],
    },
  },
  {
    version: '1.0.19',
    date: '2026-10-01',
    changes: {
      de: ['Beim Bearbeiten eines Tages legt das Plus in jeder Gruppe direkt eine neue Aktivität an', 'Viele neue Icons für Aktivitäten und Stimmungen zur Auswahl'],
      en: ['When editing a day, the plus in each group adds a new activity right away', 'Many new icons to choose from for activities and moods'],
    },
  },
  {
    version: '1.0.18',
    date: '2026-10-01',
    changes: {
      de: ['Beim ersten Start wählt die App Deutsch, wenn das Gerät auf Deutsch steht, sonst Englisch'],
      en: ['On first launch the app picks German if the device is set to German, otherwise English'],
    },
  },
  {
    version: '1.0.17',
    date: '2026-09-30',
    changes: {
      de: [
        '„Beispieldaten laden“ erzeugt ein Jahr auf Englisch, wenn die App auf Englisch eingestellt ist',
        'Beim Import englischer Dateien landen weitere Aktivitäten bei den passenden Standardaktivitäten',
      ],
      en: [
        '“Load sample data” creates a year in English when the app is set to English',
        'Importing English files matches more activities to the built-in ones',
      ],
    },
  },
  {
    version: '1.0.16',
    date: '2026-09-30',
    changes: {
      de: ['Erinnerungen kommen ohne Google-Dienste aus, die App enthält kein Firebase mehr'],
      en: ['Reminders work without Google services, the app no longer contains Firebase'],
    },
  },
  {
    version: '1.0.15',
    date: '2026-09-30',
    changes: {
      de: ['Die Updatehistorie gibt es jetzt auch auf Englisch'],
      en: ['The update history is now also available in English'],
    },
  },
  {
    version: '1.0.14',
    date: '2026-09-30',
    changes: {
      de: [
        'Daylight gibt es jetzt auch auf Englisch, umschalten lässt sich unter „Mehr“ bei „Sprache“',
        'Datum und Zahlen erscheinen passend zur gewählten Sprache',
        'Englische Dateien landen beim Import in den passenden Gruppen',
        'Neue Tagebücher starten mit eigenen Stimmungsnamen, die schwächste Stufe heißt jetzt „Mies“',
      ],
      en: [
        'Daylight is now also available in English, switch under “More” at “Language”',
        'Dates and numbers follow the chosen language',
        'English files land in the matching groups when imported',
        'New journals start with Daylight\'s own mood names: Great, Good, Okay, Bad and Awful',
      ],
    },
  },
  {
    version: '1.0.13',
    date: '2026-09-30',
    changes: {
      de: [
        'Daylight ist jetzt freie Software, Lizenz und Quellcode stehen unter „Über“',
        'Neuer Signaturschlüssel: vor dem Update eine Sicherung teilen, die alte App deinstallieren und die Sicherung danach wieder einspielen',
      ],
      en: [
        'Daylight is now free software, license and source code are under “About”',
        'New signing key: before updating, share a backup, uninstall the old app and restore the backup afterwards',
      ],
    },
  },
  {
    version: '1.0.12',
    date: '2026-09-28',
    changes: {
      de: [
        'Fotos in der Vollansicht lassen sich mit zwei Fingern oder per Doppeltipp vergrößern und im Zoom verschieben',
      ],
      en: [
        'Photos in full view can be zoomed with two fingers or a double tap and moved around while zoomed',
      ],
    },
  },
  {
    version: '1.0.11',
    date: '2026-09-28',
    changes: {
      de: [
        'Kleinere Korrekturen im Hintergrund',
      ],
      en: [
        'Minor fixes in the background',
      ],
    },
  },
  {
    version: '1.0.10',
    date: '2026-09-27',
    changes: {
      de: [
        'Ein Eintrag im Verlauf öffnet seinen Tag, bearbeitet wird von dort aus',
        'Heute ist aufgeräumt: ohne die Karte „Die nächsten Tage“ und ohne den Hinweis zum Schlaf',
      ],
      en: [
        'An entry in History opens its day, editing starts from there',
        'Today is tidier: without the “Next days” card and without the sleep note',
      ],
    },
  },
  {
    version: '1.0.9',
    date: '2026-09-27',
    changes: {
      de: [
        'Der Rückblick auf Heute zeigt die Fotos der Tage, ein Tipp öffnet sie groß',
      ],
      en: [
        'The look back on Today shows the photos of those days, a tap opens them full size',
      ],
    },
  },
  {
    version: '1.0.8',
    date: '2026-09-27',
    changes: {
      de: [
        'Zurück wechselt auf Android zum zuletzt geöffneten Tab, die App schließt sich erst auf Heute',
      ],
      en: [
        'Back on Android switches to the last opened tab, the app only closes on Today',
      ],
    },
  },
  {
    version: '1.0.7',
    date: '2026-09-27',
    changes: {
      de: [
        'Einblicke sind in Bereiche aufgeteilt: Stimmung, Muster, Aktivitäten, Gesundheit, Zusammenhänge und Notizen',
        'Gesundheit zeigt Verlauf, Wochentage, Ziele mit Serien und Bestwerte für Schlaf, Schritte, Ruhepuls und Training',
        'Zusammenhänge vergleichen gute und schwierige Tage und zeigen, wie Schlaf und Bewegung mit der Stimmung zusammengehen',
        'Aktivitäten lassen sich mit Schlaf in der Nacht danach, Schritten, Ruhepuls und Training vergleichen',
      ],
      en: [
        'Insights are split into sections: Mood, Patterns, Activities, Health, Connections and Notes',
        'Health shows trends, weekdays, goals with streaks and records for sleep, steps, resting heart rate and exercise',
        'Connections compare good and hard days and show how sleep and exercise go along with mood',
        'Activities can be compared with sleep the night after, steps, resting heart rate and exercise',
      ],
    },
  },
  {
    version: '1.0.6',
    date: '2026-09-27',
    changes: {
      de: [
        'Heute zeigt Schlaf, Schritte, Training und Ruhepuls des gewählten Tages',
        'Im Verlauf steht an jedem Eintrag eine kurze Zeile mit Schlaf, Schritten und Training',
      ],
      en: [
        'Today shows sleep, steps, exercise and resting heart rate of the selected day',
        'In History, every entry has a short line with sleep, steps and exercise',
      ],
    },
  },
  {
    version: '1.0.5',
    date: '2026-09-27',
    changes: {
      de: [
        'Schritte, Schlaf, Ruhepuls und Training kommen aus Health Connect, etwa von Samsung Health und der Galaxy Watch',
        'Abgeglichen wird beim Öffnen der App und rückwirkend bis zum ersten Eintrag, ein kleiner Kreis oben rechts zeigt es an',
        'Einblicke zeigen die Stimmung nach Schlaf, Schritten und Training',
        'Daylight liest nur und schreibt nichts nach Health Connect, die Gesundheitsdaten lassen sich jederzeit trennen und löschen',
      ],
      en: [
        'Steps, sleep, resting heart rate and exercise come from Health Connect, for example from Samsung Health and the Galaxy Watch',
        'Syncing happens when the app opens and goes back to the first entry, a small circle at the top right shows it',
        'Insights show mood by sleep, steps and exercise',
        'Daylight only reads and writes nothing to Health Connect, the health data can be disconnected and deleted at any time',
      ],
    },
  },
  {
    version: '1.0.4',
    date: '2026-09-27',
    changes: {
      de: [
        'Jeder Eintrag kann ein Foto haben, zu sehen in Heute, im Verlauf und groß per Tipp',
        'Sicherungen aus anderen Stimmungstagebüchern lassen sich importieren und bringen die Fotos zu vorhandenen Einträgen mit',
        'Mit Fotos ist die Sicherung eine ZIP-Datei, die alles wiederherstellt',
        'Kräftigere Farben mit blauem Akzent, der Kalender liegt auf einer weißen Fläche',
      ],
      en: [
        'Every entry can have a photo, shown on Today, in History and full size with a tap',
        'Backups from other mood journals can be imported and bring the photos to existing entries',
        'With photos, the backup is a ZIP file that restores everything',
        'Stronger colours with a blue accent, the calendar sits on a white surface',
      ],
    },
  },
  {
    version: '1.0.3',
    date: '2026-09-27',
    changes: {
      de: [
        'Neues Logo: ein Wellenring mit zwölf Stunden und einer Spirale, deren Sonne auf den Abend zeigt',
        'Das Logo liegt blass im Hintergrund jeder Seite, Karten lassen es leicht durchscheinen',
        'Sperrbildschirm, Über und die tägliche Erinnerung zeigen das Logo',
      ],
      en: [
        'New logo: a wave ring with twelve hours and a spiral whose sun points to the evening',
        'The logo lies faintly in the background of every page, cards let it show through slightly',
        'The lock screen, About and the daily reminder show the logo',
      ],
    },
  },
  {
    version: '1.0.2',
    date: '2026-09-26',
    changes: {
      de: [
        'Pro Tag gibt es einen Eintrag, ein weiterer Tipp auf den Tag öffnet den vorhandenen',
        'Einträge haben keinen Titel mehr, ein alter Titel steht als erste Zeile in der Notiz',
        'Beim Schreiben der Notiz rutscht der Text über die Tastatur',
        'Heute zeigt einen Rückblick auf den Tag vor einer Woche, einem Monat, sechs Monaten und einem Jahr',
        'Die Stimmung Ok ist jetzt gelb statt blau',
      ],
      en: [
        'There is one entry per day, another tap on the day opens the existing one',
        'Entries no longer have a title, an old title becomes the first line of the note',
        'While writing the note, the text moves above the keyboard',
        'Today shows a look back at the day a week, a month, six months and a year ago',
        'The mood Ok is now yellow instead of blue',
      ],
    },
  },
  {
    version: '1.0.1',
    date: '2026-09-26',
    changes: {
      de: [
        'Die App-Sperre fragt nach dem Entsperren mit der Geräte-PIN nicht gleich wieder',
        'Erinnerungen werden sauber neu gestellt, auch wenn kurz nacheinander etwas passiert',
        'Einblicke: längste Folge in voller Länge, Wörter nur aus Tagen mit Notiz, übliche Uhrzeit auch nach Mitternacht, Zahlen richtig gerundet',
        'Unter Mehr lässt sich wählen, ob die Woche am Montag oder am Sonntag beginnt',
        'Der Screenreader nennt am Hinweis auf die Telefonseelsorge ihren Namen',
      ],
      en: [
        'The app lock no longer asks again right after unlocking with the device PIN',
        'Reminders are rescheduled cleanly, even when several things happen in quick succession',
        'Insights: longest streak in full length, words only from days with a note, usual time also after midnight, numbers rounded correctly',
        'Under More you can choose whether the week starts on Monday or Sunday',
        'The screen reader names the TelefonSeelsorge on its note',
      ],
    },
  },
  {
    version: '1.0.0',
    date: '2026-09-26',
    changes: {
      de: [
        'Erste Version: Exporte aus anderen Stimmungstagebüchern lassen sich vollständig importieren',
        'Einträge mit Stimmung, Aktivitäten, Skalen und Notiz erfassen, auf Heute durch die Tage wischen',
        'Kalender mit Stimmungsfarbe und Symbol je Tag, Verlauf mit Suche und Filtern',
        'Stimmungen, Aktivitäten, Gruppen und Skalen verwalten, sortieren und zusammenführen',
        'Einblicke über 30 Tage, 90 Tage, ein Jahr oder alles: Verlauf, Verteilung, Jahr in Pixeln, Wochentage, Monate, Schwankung und Serien',
        'Aktivitäten im Vergleich: Stimmung mit und ohne, am Folgetag, oft zusammen, vor schwierigen Tagen, je Gruppe',
        'Häufige Wörter in Notizen und Umfang des Tagebuchs, alles nur auf dem Gerät berechnet',
        'Eigene Seite je Aktivität und je Stimmung',
        'Ausblick auf die nächsten sieben Tage, nur wo er bisher genauer war als „immer die häufigste Stimmung“, sonst Wochentage und Gewohntes',
        'Aktivitäten für künftige Tage planen, der Kalender zeigt sie an',
        'Tägliche Erinnerung zur gewählten Uhrzeit, die an Tagen mit Eintrag entfällt',
        'App-Sperre mit der Entsperrung des Geräts, Bildschirmfotos und Vorschau gesperrt',
        'Hinweis auf eine Sicherung nach 60 Tagen, ruhiger Hinweis auf die Telefonseelsorge nach vielen schweren Tagen',
        'Sicherung als JSON und Export als CSV',
        'Beispieldaten zum Ausprobieren',
      ],
      en: [
        'First version: exports from other mood journals can be imported completely',
        'Record entries with mood, activities, scales and note, swipe through the days on Today',
        'Calendar with mood colour and icon per day, History with search and filters',
        'Manage, sort and merge moods, activities, groups and scales',
        'Insights over 30 days, 90 days, a year or all: trend, distribution, year in pixels, weekdays, months, swings and streaks',
        'Activities compared: mood with and without, on the next day, often together, before hard days, per group',
        'Frequent words in notes and scope of the journal, all calculated only on the device',
        'A page for each activity and each mood',
        'Outlook on the next seven days, only where it was more accurate so far than “always the most frequent mood”, otherwise weekdays and habits',
        'Plan activities for future days, the calendar shows them',
        'Daily reminder at the chosen time, skipped on days with an entry',
        'App lock using the device unlock, screenshots and preview blocked',
        'Note about a backup after 60 days, quiet note about the TelefonSeelsorge after many hard days',
        'Backup as JSON and export as CSV',
        'Sample data to try things out',
      ],
    },
  },
];
