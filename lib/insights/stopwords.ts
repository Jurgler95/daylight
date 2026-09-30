import { fold } from '@/lib/search/fold';

/**
 * German function words, auxiliaries and fillers that say nothing about a day. Stored folded,
 * like the words they are compared against, so "für" and "fur" are the same entry.
 */
const WORDS = `
aber alle allem allen aller alles als also am an ander andere anderem anderen anderer anderes auch auf aus bei beim bin bis bist
bzw da dabei dadurch dafür dagegen daher damit dann dar daran darauf daraus darf darum das dass dasselbe davon davor dazu dein
deine deinem deinen deiner dem den denn der deren des deshalb dessen die dies diese diesem diesen dieser dieses dir doch dort du
durch eben ein eine einem einen einer eines einige einigen einmal er es etwas euch euer eure für gab gar gegen gehabt gewesen
ging gibt habe haben hab hat hatte hatten hattest hast hier hin hinter ich ihm ihn ihnen ihr ihre ihrem ihren ihrer im immer in
ins ist ja je jede jedem jeden jeder jedes jedoch jetzt kann kannst kein keine keinem keinen keiner konnte könnte machen macht
mal man manche manchem manchen mancher manches mehr mein meine meinem meinen meiner mich mir mit muss musste nach nachdem nein
nicht nichts noch nun nur ob oder ohne sehr sein seine seinem seinen seiner seit selbst sich sie sind so sodass solche soll
sollte sondern sonst über um und uns unser unsere unter viel vom von vor wann war waren warst warum was weg weil weiter welche
welchem welchen welcher welches wenn wer werde werden wie wieder will wir wird wirst wo wohl wollen wollte würde würden zu zum
zur zwar zwischen heute gestern morgen abend abends mittag tag tage tagen heut eigentlich irgendwie ganz ziemlich etwa schon
bisschen etwas echt einfach wirklich total richtig gerade grad wurde wurden bekommen kam kamen gemacht geht ging gegangen
ab okay ok naja halt eher dann denen dessen deren sowie sowas sowieso trotzdem obwohl während wegen danach davor beide beiden
`;

export const STOPWORDS: ReadonlySet<string> = new Set(WORDS.split(/\s+/).filter(Boolean).map(fold));
