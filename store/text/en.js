// Texte der Store-Grafiken, geladen von store/graphics.html. Je Screenshot [Kicker, Überschrift, Unterzeile];
// <br> bricht die Überschrift um, <em> setzt das Wort in Akzentfarbe.
window.STORE_TEXT = {
  1: ['Mood journal', 'How was<br>your <em>day?</em>', 'One tap is enough. Notes, a photo and activities if you like.'],
  2: ['Quick entry', 'Tap.<br>Pick. <em>Done.</em>', 'Mood and activities in seconds, sorted into your own groups.'],
  3: ['Calendar', 'Every day<br>in <em>its color</em>', 'Your month at a glance, with plans for the days ahead.'],
  4: ['Insights', 'Spot your<br><em>patterns</em>', 'Trends, weekdays and what comes with good days. Descriptive, never a diagnosis.'],
  5: ['Year in pixels', 'Your year<br>at <em>a glance</em>', 'Every day a pixel. Tap one to open the day.'],
  6: ['Outlook', 'An <em>honest</em><br>look ahead', 'Only where the estimate beats guessing on your own data. Otherwise Daylight says so.'],
  7: ['Turning points', 'The day that<br><em>changed things</em>', 'Give the day a name. Daylight compares the time before with the time after.'],
  8: ['Private', 'Stays on<br><em>your phone</em>', 'Your entries live only on your device. You share backups yourself, if you want to.'],
  badges: ['No internet', 'No account', 'No ads', 'App lock'],
  tagline: 'Your mood journal.<br>Private, offline, on your device.',
  // WhatsApp-Status: Zeile unter der Sonne und Hinweis auf den Link in der Bildunterschrift darunter
  status: { button: 'Now on Google Play', hint: 'Tap the link below' },
  // Ausschnitte [x, y, Breite, Höhe] aus store/screens/<lang>/: Aktivitäten im Editor, Verlauf und Zusammenfassung im Vergleich
  crops: { editorActivities: [90, 930, 880, 540], compareHistory: [42, 393, 994, 720], compareSummary: [42, 1932, 994, 326] },
};
