// @ts-nocheck
// CapturaGo edge function: create-checkout
// GENERATED from supabase/functions/_src — edit there and re-run build.py

// ── Email texts in German, Spanish and French (the English sentence is the key; {name} = filled in) ──
// Used by L(lang, english, vars) in lib.js. A sentence missing here is sent in English.
// Keep the {placeholders} and HTML tags of the English sentence in every translation (checked by the tests).
const MAIL_TEXT = {
  // greetings + shared bits
  'Hi {name},': { de: 'Hallo {name},', es: 'Hola, {name}:', fr: 'Bonjour {name},' },
  'Hi there,': { de: 'Hallo,', es: 'Hola:', fr: 'Bonjour,' },
  'Hi,': { de: 'Hallo,', es: 'Hola:', fr: 'Bonjour,' },
  'An update from CapturaGo': { de: 'Neuigkeiten von CapturaGo', es: 'Novedades de CapturaGo', fr: 'Des nouvelles de CapturaGo' },
  'View your bookings': { de: 'Deine Buchungen ansehen', es: 'Ver tus reservas', fr: 'Voir tes réservations' },
  'Open your bookings': { de: 'Deine Buchungen öffnen', es: 'Abrir tus reservas', fr: 'Ouvrir tes réservations' },
  'your bookings': { de: 'deinen Buchungen', es: 'tus reservas', fr: 'tes réservations' },
  'Open your dashboard': { de: 'Dein Dashboard öffnen', es: 'Abrir tu panel', fr: 'Ouvrir ton tableau de bord' },
  'Open my dashboard': { de: 'Mein Dashboard öffnen', es: 'Abrir mi panel', fr: 'Ouvrir mon tableau de bord' },
  'Your creator': { de: 'Dein Creator', es: 'Tu creador', fr: 'Ton créateur' },
  'your creator': { de: 'deinem Creator', es: 'tu creador', fr: 'ton créateur' },
  'your client': { de: 'deinen Kunden', es: 'tu cliente', fr: 'ton client' },
  'A traveller': { de: 'Ein Reisender', es: 'Un viajero', fr: 'Un voyageur' },
  ' and ': { de: ' und ', es: ' y ', fr: ' et ' },
  '{amount} ({gift} from a gift card)': { de: '{amount} ({gift} per Gutschein)', es: '{amount} ({gift} con tarjeta regalo)', fr: '{amount} ({gift} par carte cadeau)' },
  '{card} to your card and {gift} back on your gift card': { de: '{card} auf deine Karte und {gift} zurück auf deinen Gutschein', es: '{card} a tu tarjeta y {gift} de vuelta en tu tarjeta regalo', fr: '{card} sur ta carte et {gift} recrédités sur ta carte cadeau' },

  // times of day, problems, services (labels used inside sentences)
  'Sunrise': { de: 'Sonnenaufgang', es: 'Amanecer', fr: 'Lever du soleil' },
  'Morning': { de: 'Morgen', es: 'Mañana', fr: 'Matin' },
  'Midday': { de: 'Mittag', es: 'Mediodía', fr: 'Midi' },
  'Afternoon': { de: 'Nachmittag', es: 'Tarde', fr: 'Après-midi' },
  'Golden hour': { de: 'Goldene Stunde', es: 'Hora dorada', fr: 'Heure dorée' },
  'Evening': { de: 'Abend', es: 'Noche', fr: 'Soir' },
  'Flexible time': { de: 'Flexible Zeit', es: 'Hora flexible', fr: 'Heure flexible' },
  'Creator did not show up': { de: 'Creator ist nicht erschienen', es: 'El creador no se presentó', fr: 'Le créateur ne s\'est pas présenté' },
  'Not what was agreed': { de: 'Nicht wie vereinbart', es: 'No es lo acordado', fr: 'Pas ce qui était convenu' },
  'Photos are late': { de: 'Fotos sind verspätet', es: 'Las fotos se retrasan', fr: 'Les photos sont en retard' },
  'Other problem': { de: 'Anderes Problem', es: 'Otro problema', fr: 'Autre problème' },
  'photographer': { de: 'Fotograf', es: 'fotógrafo', fr: 'photographe' },
  'videographer': { de: 'Videograf', es: 'videógrafo', fr: 'vidéaste' },
  'phone content creator': { de: 'Handy-Content-Creator', es: 'creador de contenido con móvil', fr: 'créateur de contenu au smartphone' },
  'drone pilot': { de: 'Drohnenpilot', es: 'piloto de dron', fr: 'pilote de drone' },
  'photo guide': { de: 'Foto-Guide', es: 'guía fotográfico', fr: 'guide photo' },
  'event photographer': { de: 'Eventfotograf', es: 'fotógrafo de eventos', fr: 'photographe d\'événements' },

  // new booking (creator)
  'due by {date}': { de: 'fällig bis {date}', es: 'con entrega el {date}', fr: 'à livrer avant le {date}' },
  'on {date} in {city}': { de: 'am {date} in {city}', es: 'el {date} en {city}', fr: 'le {date} à {city}' },
  'on {date}': { de: 'am {date}', es: 'el {date}', fr: 'le {date}' },
  'when the client approves your delivery': { de: 'wenn der Kunde deine Lieferung freigibt', es: 'cuando el cliente apruebe tu entrega', fr: 'quand le client approuve ta livraison' },
  '{n} days after you send the photos': { de: '{n} Tage nachdem du die Fotos geschickt hast', es: '{n} días después de enviar las fotos', fr: '{n} jours après l\'envoi des photos' },
  'after the shoot': { de: 'nach dem Shooting', es: 'después de la sesión', fr: 'après le shooting' },
  '✨ Booked through your personal CapturaGo link.': { de: '✨ Über deinen persönlichen CapturaGo-Link gebucht.', es: '✨ Reservado a través de tu enlace personal de CapturaGo.', fr: '✨ Réservé via ton lien CapturaGo personnel.' },
  '👥 {n} friends shared the cost.': { de: '👥 {n} Freunde haben sich die Kosten geteilt.', es: '👥 {n} amigos compartieron el coste.', fr: '👥 {n} amis ont partagé le coût.' },
  '🤫 <strong>It\'s a surprise</strong> (for example a proposal) — the other person doesn\'t know. Please don\'t contact or tag them before the moment; plan everything with the traveller in your CapturaGo messages.': {
    de: '🤫 <strong>Es ist eine Überraschung</strong> (zum Beispiel ein Heiratsantrag) — die andere Person weiß nichts davon. Bitte kontaktiere oder markiere sie vorher nicht; plane alles mit dem Reisenden in deinen CapturaGo-Nachrichten.',
    es: '🤫 <strong>Es una sorpresa</strong> (por ejemplo, una pedida de mano): la otra persona no lo sabe. No la contactes ni la etiquetes antes del momento; planifícalo todo con el viajero en tus mensajes de CapturaGo.',
    fr: '🤫 <strong>C\'est une surprise</strong> (par exemple une demande en mariage) — l\'autre personne n\'est pas au courant. Ne la contacte pas et ne l\'identifie pas avant le moment ; organise tout avec le voyageur dans tes messages CapturaGo.' },
  'Confirmed booking: {pkg} on {date}': { de: 'Bestätigte Buchung: {pkg} am {date}', es: 'Reserva confirmada: {pkg} el {date}', fr: 'Réservation confirmée : {pkg} le {date}' },
  'New order: {pkg} (due {date})': { de: 'Neuer Auftrag: {pkg} (fällig {date})', es: 'Nuevo pedido: {pkg} (entrega {date})', fr: 'Nouvelle commande : {pkg} (pour le {date})' },
  'New booking: {pkg} on {date}': { de: 'Neue Buchung: {pkg} am {date}', es: 'Nueva reserva: {pkg} el {date}', fr: 'Nouvelle réservation : {pkg} le {date}' },
  '{client} booked {pkg} {when} and paid {amount}.': { de: '{client} hat {pkg} {when} gebucht und {amount} bezahlt.', es: '{client} reservó {pkg} {when} y pagó {amount}.', fr: '{client} a réservé {pkg} {when} et a payé {amount}.' },
  'Their note: “{note}”': { de: 'Notiz: „{note}“', es: 'Su nota: «{note}»', fr: 'Sa note : « {note} »' },
  'Their files: {link}': { de: 'Dateien: {link}', es: 'Sus archivos: {link}', fr: 'Ses fichiers : {link}' },
  '⚡ It\'s <strong>confirmed automatically</strong> because you use instant booking. {open} to message {first}. The payment is released to you {release}.': {
    de: '⚡ Sie ist <strong>automatisch bestätigt</strong>, weil du Sofortbuchung nutzt. {open}, um {first} zu schreiben. Die Zahlung wird dir {release} ausgezahlt.',
    es: '⚡ Está <strong>confirmada automáticamente</strong> porque usas la reserva inmediata. {open} para escribir a {first}. El pago se te libera {release}.',
    fr: '⚡ Elle est <strong>confirmée automatiquement</strong> car tu utilises la réservation instantanée. {open} pour écrire à {first}. Le paiement t\'est versé {release}.' },
  'Please {action}. The payment is held safely and released to you {release}.': { de: 'Bitte {action}. Die Zahlung ist sicher verwahrt und wird dir {release} ausgezahlt.', es: 'Por favor, {action}. El pago está retenido de forma segura y se te libera {release}.', fr: 'Merci de {action}. Le paiement est conservé en sécurité et t\'est versé {release}.' },
  'accept the order in your dashboard': { de: 'nimm den Auftrag in deinem Dashboard an', es: 'acepta el pedido en tu panel', fr: 'accepter la commande dans ton tableau de bord' },
  'confirm the booking in your dashboard': { de: 'bestätige die Buchung in deinem Dashboard', es: 'confirma la reserva en tu panel', fr: 'confirmer la réservation dans ton tableau de bord' },

  // new booking (traveller)
  'you approve the delivery': { de: 'du die Lieferung freigibst', es: 'apruebes la entrega', fr: 'tu approuves la livraison' },
  'your photos arrive': { de: 'deine Fotos da sind', es: 'lleguen tus fotos', fr: 'l\'arrivée de tes photos' },
  'your shoot is done': { de: 'nach deinem Shooting', es: 'después de tu sesión', fr: 'la fin de ton shooting' },
  'Confirmed — {pkg} on {date}': { de: 'Bestätigt — {pkg} am {date}', es: 'Confirmada: {pkg} el {date}', fr: 'Confirmé — {pkg} le {date}' },
  'Booking received — {pkg}': { de: 'Buchung erhalten — {pkg}', es: 'Reserva recibida: {pkg}', fr: 'Réservation reçue — {pkg}' },
  'Your payment of {amount} for {pkg} {when} is received and held safely by CapturaGo until {until}.': { de: 'Deine Zahlung von {amount} für {pkg} {when} ist eingegangen und wird von CapturaGo sicher verwahrt, bis {until}.', es: 'Tu pago de {amount} por {pkg} {when} se ha recibido y CapturaGo lo guarda de forma segura hasta que {until}.', fr: 'Ton paiement de {amount} pour {pkg} {when} est reçu et conservé en sécurité par CapturaGo jusqu\'à {until}.' },
  'Your payment of {amount} for {pkg} {when} is confirmed and held safely by CapturaGo until {until}.': { de: 'Deine Zahlung von {amount} für {pkg} {when} ist bestätigt und wird von CapturaGo sicher verwahrt, bis {until}.', es: 'Tu pago de {amount} por {pkg} {when} está confirmado y CapturaGo lo guarda de forma segura hasta que {until}.', fr: 'Ton paiement de {amount} pour {pkg} {when} est confirmé et conservé en sécurité par CapturaGo jusqu\'à {until}.' },
  'Everyone has paid their share — {amount} in total for {pkg} {when} is received and held safely by CapturaGo until {until}.': { de: 'Alle haben ihren Anteil bezahlt — insgesamt {amount} für {pkg} {when} sind eingegangen und werden von CapturaGo sicher verwahrt, bis {until}.', es: 'Todos han pagado su parte: el total de {amount} por {pkg} {when} se ha recibido y CapturaGo lo guarda de forma segura hasta que {until}.', fr: 'Tout le monde a payé sa part — le total de {amount} pour {pkg} {when} est reçu et conservé en sécurité par CapturaGo jusqu\'à {until}.' },
  'Everyone has paid their share — {amount} in total for {pkg} {when} is confirmed and held safely by CapturaGo until {until}.': { de: 'Alle haben ihren Anteil bezahlt — insgesamt {amount} für {pkg} {when} sind bestätigt und werden von CapturaGo sicher verwahrt, bis {until}.', es: 'Todos han pagado su parte: el total de {amount} por {pkg} {when} está confirmado y CapturaGo lo guarda de forma segura hasta que {until}.', fr: 'Tout le monde a payé sa part — le total de {amount} pour {pkg} {when} est confirmé et conservé en sécurité par CapturaGo jusqu\'à {until}.' },
  '⚡ <strong>Your shoot is confirmed.</strong> Message your creator in {link} to plan the details.': { de: '⚡ <strong>Dein Shooting ist bestätigt.</strong> Schreib deinem Creator auf {link}, um die Details zu planen.', es: '⚡ <strong>Tu sesión está confirmada.</strong> Escribe a tu creador en {link} para planificar los detalles.', fr: '⚡ <strong>Ton shooting est confirmé.</strong> Écris à ton créateur sur {link} pour organiser les détails.' },
  'The creator will confirm shortly. Track it in {link}.': { de: 'Der Creator bestätigt in Kürze. Verfolge es in {link}.', es: 'El creador confirmará en breve. Síguelo en {link}.', fr: 'Le créateur confirmera bientôt. Suis-la dans {link}.' },

  // shoot plan
  '🌍 City: {city} (the creator\'s trip)': { de: '🌍 Stadt: {city} (Reise des Creators)', es: '🌍 Ciudad: {city} (viaje del creador)', fr: '🌍 Ville : {city} (voyage du créateur)' },
  '📍 Meeting point: {place}': { de: '📍 Treffpunkt: {place}', es: '📍 Punto de encuentro: {place}', fr: '📍 Point de rendez-vous : {place}' },
  '🕒 Time: {time}': { de: '🕒 Uhrzeit: {time}', es: '🕒 Hora: {time}', fr: '🕒 Heure : {time}' },
  '🤫 <strong>Surprise:</strong> the other person doesn\'t know — don\'t contact or tag them before the moment.': { de: '🤫 <strong>Überraschung:</strong> Die andere Person weiß nichts — kontaktiere oder markiere sie vorher nicht.', es: '🤫 <strong>Sorpresa:</strong> la otra persona no lo sabe; no la contactes ni la etiquetes antes del momento.', fr: '🤫 <strong>Surprise :</strong> l\'autre personne n\'est pas au courant — ne la contacte pas et ne l\'identifie pas avant le moment.' },
  '📝 Shot list: {list}': { de: '📝 Shotlist: {list}', es: '📝 Lista de fotos: {list}', fr: '📝 Liste de photos : {list}' },

  // booking actions
  'Confirmed: {pkg}': { de: 'Bestätigt: {pkg}', es: 'Confirmada: {pkg}', fr: 'Confirmé : {pkg}' },
  'Your order {pkg} was accepted. Delivery is due by {date}. Your payment stays protected until you approve the result.': { de: 'Dein Auftrag {pkg} wurde angenommen. Die Lieferung ist bis {date} fällig. Deine Zahlung bleibt geschützt, bis du das Ergebnis freigibst.', es: 'Tu pedido {pkg} ha sido aceptado. La entrega está prevista para el {date}. Tu pago sigue protegido hasta que apruebes el resultado.', fr: 'Ta commande {pkg} a été acceptée. La livraison est prévue avant le {date}. Ton paiement reste protégé jusqu\'à ce que tu approuves le résultat.' },
  'Great news — your shoot {pkg} on {date} is confirmed. Your payment stays protected until the shoot is done.': { de: 'Gute Nachrichten — dein Shooting {pkg} am {date} ist bestätigt. Deine Zahlung bleibt bis nach dem Shooting geschützt.', es: '¡Buenas noticias! Tu sesión {pkg} del {date} está confirmada. Tu pago sigue protegido hasta después de la sesión.', fr: 'Bonne nouvelle — ton shooting {pkg} du {date} est confirmé. Ton paiement reste protégé jusqu\'à la fin du shooting.' },
  'Booking declined — full refund': { de: 'Buchung abgelehnt — volle Erstattung', es: 'Reserva rechazada: reembolso completo', fr: 'Réservation refusée — remboursement intégral' },
  'Unfortunately the creator can\'t take {pkg}. You\'ve been refunded in full ({amount}); it can take 5–10 days to appear.': { de: 'Leider kann der Creator {pkg} nicht übernehmen. Du bekommst alles zurück ({amount}); das kann 5–10 Tage dauern.', es: 'Lamentablemente, el creador no puede aceptar {pkg}. Te hemos reembolsado el importe completo ({amount}); puede tardar entre 5 y 10 días en aparecer.', fr: 'Malheureusement, le créateur ne peut pas prendre {pkg}. Tu as été remboursé intégralement ({amount}) ; cela peut prendre 5 à 10 jours.' },
  'your CapturaGo gallery': { de: 'deiner CapturaGo-Galerie', es: 'tu galería de CapturaGo', fr: 'ta galerie CapturaGo' },
  'Delivered: {pkg}': { de: 'Geliefert: {pkg}', es: 'Entregado: {pkg}', fr: 'Livré : {pkg}' },
  'Your files are ready in {where}.': { de: 'Deine Dateien liegen bereit in {where}.', es: 'Tus archivos están listos en {where}.', fr: 'Tes fichiers sont prêts dans {where}.' },
  'Please approve the delivery or request a revision ({n} left) in your dashboard.': { de: 'Bitte gib die Lieferung in deinem Dashboard frei oder fordere eine Überarbeitung an (noch {n}).', es: 'Aprueba la entrega o pide una revisión (te quedan {n}) en tu panel.', fr: 'Approuve la livraison ou demande une retouche (il en reste {n}) dans ton tableau de bord.' },
  'Please approve the delivery in your dashboard.': { de: 'Bitte gib die Lieferung in deinem Dashboard frei.', es: 'Aprueba la entrega en tu panel.', fr: 'Approuve la livraison dans ton tableau de bord.' },
  'If we don\'t hear from you within {n} days, the payment is released to the creator.': { de: 'Hören wir innerhalb von {n} Tagen nichts von dir, wird die Zahlung an den Creator ausgezahlt.', es: 'Si no sabemos nada de ti en {n} días, el pago se libera al creador.', fr: 'Sans nouvelles de ta part sous {n} jours, le paiement est versé au créateur.' },
  '📸 Your photos are ready — {pkg}': { de: '📸 Deine Fotos sind fertig — {pkg}', es: '📸 Tus fotos están listas: {pkg}', fr: '📸 Tes photos sont prêtes — {pkg}' },
  '{n} photos are waiting for you in your private CapturaGo gallery: {link} (or open the CapturaGo app → Bookings).': { de: '{n} Fotos warten in deiner privaten CapturaGo-Galerie auf dich: {link} (oder öffne die CapturaGo-App → Buchungen).', es: '{n} fotos te esperan en tu galería privada de CapturaGo: {link} (o abre la app de CapturaGo → Reservas).', fr: '{n} photos t\'attendent dans ta galerie CapturaGo privée : {link} (ou ouvre l\'app CapturaGo → Réservations).' },
  '{n} photo is waiting for you in your private CapturaGo gallery: {link} (or open the CapturaGo app → Bookings).': { de: '{n} Foto wartet in deiner privaten CapturaGo-Galerie auf dich: {link} (oder öffne die CapturaGo-App → Buchungen).', es: '{n} foto te espera en tu galería privada de CapturaGo: {link} (o abre la app de CapturaGo → Reservas).', fr: '{n} photo t\'attend dans ta galerie CapturaGo privée : {link} (ou ouvre l\'app CapturaGo → Réservations).' },
  'view &amp; download': { de: 'ansehen &amp; herunterladen', es: 'ver y descargar', fr: 'voir &amp; télécharger' },
  'Please download your favourites — the gallery is kept for 90 days after the booking is completed.': { de: 'Bitte lade deine Lieblingsfotos herunter — die Galerie bleibt 90 Tage nach Abschluss der Buchung erhalten.', es: 'Descarga tus favoritas: la galería se conserva 90 días después de completar la reserva.', fr: 'Télécharge tes préférées — la galerie est conservée 90 jours après la fin de la réservation.' },
  'Your payment stays on hold for {n} more days. If something isn\'t right, report a problem in your bookings before then.': { de: 'Deine Zahlung bleibt noch {n} Tage zurückgehalten. Stimmt etwas nicht, melde bis dahin ein Problem in deinen Buchungen.', es: 'Tu pago sigue retenido {n} días más. Si algo no está bien, comunica un problema en tus reservas antes de que termine ese plazo.', fr: 'Ton paiement reste bloqué encore {n} jours. Si quelque chose ne va pas, signale un problème dans tes réservations d\'ici là.' },
  'Revision requested: {pkg}': { de: 'Überarbeitung gewünscht: {pkg}', es: 'Revisión solicitada: {pkg}', fr: 'Retouche demandée : {pkg}' },
  '{name} asked for changes:': { de: '{name} wünscht Änderungen:', es: '{name} ha pedido cambios:', fr: '{name} demande des modifications :' },
  'Please deliver the updated files from your dashboard.': { de: 'Bitte liefere die überarbeiteten Dateien über dein Dashboard.', es: 'Entrega los archivos actualizados desde tu panel.', fr: 'Livre les fichiers mis à jour depuis ton tableau de bord.' },
  'Order cancelled (missed delivery date)': { de: 'Auftrag storniert (Liefertermin verpasst)', es: 'Pedido cancelado (fecha de entrega incumplida)', fr: 'Commande annulée (date de livraison dépassée)' },
  'The client cancelled {pkg} because it wasn\'t delivered by {date}. They were refunded.': { de: 'Der Kunde hat {pkg} storniert, weil bis {date} nicht geliefert wurde. Er hat sein Geld zurückbekommen.', es: 'El cliente canceló {pkg} porque no se entregó antes del {date}. Se le ha reembolsado.', fr: 'Le client a annulé {pkg} car la livraison n\'a pas eu lieu avant le {date}. Il a été remboursé.' },
  'Approved & paid: {pkg}': { de: 'Freigegeben & bezahlt: {pkg}', es: 'Aprobado y pagado: {pkg}', fr: 'Approuvé et payé : {pkg}' },
  '{name} approved your delivery. {amount} is on its way to your payout account.': { de: '{name} hat deine Lieferung freigegeben. {amount} ist unterwegs auf dein Auszahlungskonto.', es: '{name} ha aprobado tu entrega. {amount} va de camino a tu cuenta de cobro.', fr: '{name} a approuvé ta livraison. {amount} est en route vers ton compte de versement.' },
  'Problem reported: {pkg}': { de: 'Problem gemeldet: {pkg}', es: 'Problema comunicado: {pkg}', fr: 'Problème signalé : {pkg}' },
  '{name} reported a problem with the booking on {date} ({problem}). The payment is on hold while our team reviews it — we\'ll contact you both by email. You can reply to the traveller in your CapturaGo messages.': {
    de: '{name} hat ein Problem mit der Buchung am {date} gemeldet ({problem}). Die Zahlung ist angehalten, während unser Team es prüft — wir melden uns bei euch beiden per E-Mail. Du kannst dem Reisenden in deinen CapturaGo-Nachrichten antworten.',
    es: '{name} ha comunicado un problema con la reserva del {date} ({problem}). El pago queda en espera mientras nuestro equipo lo revisa; os contactaremos a ambos por correo. Puedes responder al viajero en tus mensajes de CapturaGo.',
    fr: '{name} a signalé un problème avec la réservation du {date} ({problem}). Le paiement est suspendu pendant que notre équipe examine la situation — nous vous contacterons tous les deux par e-mail. Tu peux répondre au voyageur dans tes messages CapturaGo.' },
  'New date proposed: {pkg}': { de: 'Neuer Termin vorgeschlagen: {pkg}', es: 'Nueva fecha propuesta: {pkg}', fr: 'Nouvelle date proposée : {pkg}' },
  '{who} proposed moving the shoot from {from} to {to} because of the weather.': { de: '{who} schlägt vor, das Shooting wegen des Wetters vom {from} auf den {to} zu verschieben.', es: '{who} propone mover la sesión del {from} al {to} por el tiempo.', fr: '{who} propose de déplacer le shooting du {from} au {to} à cause de la météo.' },
  '{who} proposed moving the shoot from {from} to {to}.': { de: '{who} schlägt vor, das Shooting vom {from} auf den {to} zu verschieben.', es: '{who} propone mover la sesión del {from} al {to}.', fr: '{who} propose de déplacer le shooting du {from} au {to}.' },
  'Please accept or decline it in your bookings.': { de: 'Bitte nimm ihn in deinen Buchungen an oder lehne ihn ab.', es: 'Acéptala o recházala en tus reservas.', fr: 'Accepte-la ou refuse-la dans tes réservations.' },
  'New date confirmed: {pkg}': { de: 'Neuer Termin bestätigt: {pkg}', es: 'Nueva fecha confirmada: {pkg}', fr: 'Nouvelle date confirmée : {pkg}' },
  'The shoot {pkg} was moved to {date}. Your payment stays protected as before.': { de: 'Das Shooting {pkg} wurde auf den {date} verschoben. Deine Zahlung bleibt wie bisher geschützt.', es: 'La sesión {pkg} se ha movido al {date}. Tu pago sigue protegido como antes.', fr: 'Le shooting {pkg} a été déplacé au {date}. Ton paiement reste protégé comme avant.' },
  'New date declined: {pkg}': { de: 'Neuer Termin abgelehnt: {pkg}', es: 'Nueva fecha rechazada: {pkg}', fr: 'Nouvelle date refusée : {pkg}' },
  'The proposal to move {pkg} to {date} was declined, so the shoot stays on {old}. Message each other to find another date.': { de: 'Der Vorschlag, {pkg} auf den {date} zu verschieben, wurde abgelehnt — das Shooting bleibt am {old}. Schreibt euch, um einen anderen Termin zu finden.', es: 'La propuesta de mover {pkg} al {date} fue rechazada, así que la sesión sigue el {old}. Escribíos para encontrar otra fecha.', fr: 'La proposition de déplacer {pkg} au {date} a été refusée, le shooting reste donc le {old}. Écrivez-vous pour trouver une autre date.' },
  'Where to meet: {pkg}': { de: 'Treffpunkt: {pkg}', es: 'Dónde quedar: {pkg}', fr: 'Où se retrouver : {pkg}' },
  'Your creator shared the plan for {date}:': { de: 'Dein Creator hat den Plan für den {date} geteilt:', es: 'Tu creador ha compartido el plan para el {date}:', fr: 'Ton créateur a partagé le programme du {date} :' },
  'Questions? Message them on CapturaGo.': { de: 'Fragen? Schreib ihm auf CapturaGo.', es: '¿Preguntas? Escríbele en CapturaGo.', fr: 'Des questions ? Écris-lui sur CapturaGo.' },

  // automatic jobs
  'Split payment didn\'t complete — everyone refunded': { de: 'Geteilte Zahlung nicht vollständig — alle bekommen ihr Geld zurück', es: 'El pago compartido no se completó: reembolso para todos', fr: 'Paiement partagé incomplet — tout le monde est remboursé' },
  'Not everyone paid their share of {pkg} ({date}) in time, so the booking was cancelled and every payment was refunded in full. Refunds can take 5–10 days to appear. You can book again any time — alone or split again.': { de: 'Nicht alle haben ihren Anteil für {pkg} ({date}) rechtzeitig bezahlt, deshalb wurde die Buchung storniert und jede Zahlung vollständig erstattet. Erstattungen können 5–10 Tage dauern. Du kannst jederzeit neu buchen — allein oder wieder geteilt.', es: 'No todos pagaron su parte de {pkg} ({date}) a tiempo, así que la reserva se canceló y se reembolsaron todos los pagos por completo. Los reembolsos pueden tardar entre 5 y 10 días. Puedes volver a reservar cuando quieras, solo o compartiendo otra vez.', fr: 'Tout le monde n\'a pas payé sa part de {pkg} ({date}) à temps : la réservation a été annulée et chaque paiement remboursé intégralement. Les remboursements peuvent prendre 5 à 10 jours. Tu peux réserver à nouveau quand tu veux — seul ou en partageant encore.' },
  'Your share was refunded': { de: 'Dein Anteil wurde erstattet', es: 'Tu parte ha sido reembolsada', fr: 'Ta part a été remboursée' },
  'Not everyone paid their share of {pkg} in time, so the booking was cancelled and your payment was refunded in full. It can take 5–10 days to appear.': { de: 'Nicht alle haben ihren Anteil für {pkg} rechtzeitig bezahlt, deshalb wurde die Buchung storniert und deine Zahlung vollständig erstattet. Das kann 5–10 Tage dauern.', es: 'No todos pagaron su parte de {pkg} a tiempo, así que la reserva se canceló y tu pago se reembolsó por completo. Puede tardar entre 5 y 10 días en aparecer.', fr: 'Tout le monde n\'a pas payé sa part de {pkg} à temps : la réservation a été annulée et ton paiement remboursé intégralement. Cela peut prendre 5 à 10 jours.' },
  'Booking cancelled — full refund': { de: 'Buchung storniert — volle Erstattung', es: 'Reserva cancelada: reembolso completo', fr: 'Réservation annulée — remboursement intégral' },
  'The creator didn\'t confirm {pkg} in time, so we cancelled it and refunded you in full ({amount}). Refunds can take 5–10 days to appear. Sorry about that — you can book another creator any time.': { de: 'Der Creator hat {pkg} nicht rechtzeitig bestätigt, deshalb haben wir storniert und dir alles erstattet ({amount}). Erstattungen können 5–10 Tage dauern. Das tut uns leid — du kannst jederzeit einen anderen Creator buchen.', es: 'El creador no confirmó {pkg} a tiempo, así que la cancelamos y te reembolsamos el importe completo ({amount}). Los reembolsos pueden tardar entre 5 y 10 días. Lo sentimos: puedes reservar a otro creador cuando quieras.', fr: 'Le créateur n\'a pas confirmé {pkg} à temps : nous l\'avons annulée et t\'avons remboursé intégralement ({amount}). Les remboursements peuvent prendre 5 à 10 jours. Désolés — tu peux réserver un autre créateur quand tu veux.' },
  'Booking cancelled: {pkg}': { de: 'Buchung storniert: {pkg}', es: 'Reserva cancelada: {pkg}', fr: 'Réservation annulée : {pkg}' },
  'You didn\'t confirm this booking in time, so it was cancelled and the client was refunded. Please confirm new bookings within 24 hours.': { de: 'Du hast diese Buchung nicht rechtzeitig bestätigt, deshalb wurde sie storniert und der Kunde hat sein Geld zurückbekommen. Bitte bestätige neue Buchungen innerhalb von 24 Stunden.', es: 'No confirmaste esta reserva a tiempo, así que se canceló y se reembolsó al cliente. Confirma las nuevas reservas en menos de 24 horas.', fr: 'Tu n\'as pas confirmé cette réservation à temps : elle a été annulée et le client remboursé. Merci de confirmer les nouvelles réservations sous 24 heures.' },
  'Please confirm: {pkg}': { de: 'Bitte bestätigen: {pkg}', es: 'Por favor, confirma: {pkg}', fr: 'À confirmer : {pkg}' },
  '{name} paid for {pkg} (due {date}). Please confirm or decline — unconfirmed bookings are cancelled and refunded after 72 hours.': { de: '{name} hat für {pkg} bezahlt (fällig {date}). Bitte bestätige oder lehne ab — unbestätigte Buchungen werden nach 72 Stunden storniert und erstattet.', es: '{name} pagó {pkg} (entrega {date}). Confirma o rechaza: las reservas sin confirmar se cancelan y reembolsan pasadas 72 horas.', fr: '{name} a payé {pkg} (pour le {date}). Confirme ou refuse — les réservations non confirmées sont annulées et remboursées après 72 heures.' },
  '{name} paid for {pkg} on {date}. Please confirm or decline — unconfirmed bookings are cancelled and refunded after 72 hours.': { de: '{name} hat für {pkg} am {date} bezahlt. Bitte bestätige oder lehne ab — unbestätigte Buchungen werden nach 72 Stunden storniert und erstattet.', es: '{name} pagó {pkg} para el {date}. Confirma o rechaza: las reservas sin confirmar se cancelan y reembolsan pasadas 72 horas.', fr: '{name} a payé {pkg} pour le {date}. Confirme ou refuse — les réservations non confirmées sont annulées et remboursées après 72 heures.' },
  'Payment released: {pkg}': { de: 'Zahlung ausgezahlt: {pkg}', es: 'Pago liberado: {pkg}', fr: 'Paiement versé : {pkg}' },
  '{amount} is on its way to your payout account. Thank you for a great job!': { de: '{amount} ist unterwegs auf dein Auszahlungskonto. Danke für deine tolle Arbeit!', es: '{amount} va de camino a tu cuenta de cobro. ¡Gracias por tu gran trabajo!', fr: '{amount} est en route vers ton compte de versement. Merci pour ton excellent travail !' },
  'Due tomorrow: {pkg}': { de: 'Morgen fällig: {pkg}', es: 'Entrega mañana: {pkg}', fr: 'À livrer demain : {pkg}' },
  'Delivery for {pkg} is due tomorrow ({date}). Deliver the files from your dashboard.': { de: 'Die Lieferung für {pkg} ist morgen fällig ({date}). Liefere die Dateien über dein Dashboard.', es: 'La entrega de {pkg} es mañana ({date}). Entrega los archivos desde tu panel.', fr: 'La livraison de {pkg} est prévue demain ({date}). Livre les fichiers depuis ton tableau de bord.' },
  'Your shoot is tomorrow: {pkg}': { de: 'Dein Shooting ist morgen: {pkg}', es: 'Tu sesión es mañana: {pkg}', fr: 'Ton shooting a lieu demain : {pkg}' },
  'Just a reminder — your shoot {pkg} is tomorrow ({date}).': { de: 'Kleine Erinnerung — dein Shooting {pkg} ist morgen ({date}).', es: 'Un recordatorio: tu sesión {pkg} es mañana ({date}).', fr: 'Petit rappel — ton shooting {pkg} a lieu demain ({date}).' },
  'Your creator hasn\'t shared a meeting point yet — message them on CapturaGo.': { de: 'Dein Creator hat noch keinen Treffpunkt geteilt — schreib ihm auf CapturaGo.', es: 'Tu creador aún no ha compartido un punto de encuentro: escríbele en CapturaGo.', fr: 'Ton créateur n\'a pas encore partagé de point de rendez-vous — écris-lui sur CapturaGo.' },
  'Enjoy it!': { de: 'Viel Spaß!', es: '¡Que lo disfrutes!', fr: 'Profite bien !' },
  'Shoot tomorrow: {pkg}': { de: 'Shooting morgen: {pkg}', es: 'Sesión mañana: {pkg}', fr: 'Shooting demain : {pkg}' },
  'Reminder: you\'re shooting {pkg} with {name} tomorrow ({date}).': { de: 'Erinnerung: Du fotografierst morgen {pkg} mit {name} ({date}).', es: 'Recordatorio: mañana haces la sesión {pkg} con {name} ({date}).', fr: 'Rappel : tu fais le shooting {pkg} avec {name} demain ({date}).' },
  'Tip: share a meeting point and time from your bookings so the traveller knows where to go.': { de: 'Tipp: Teile in deinen Buchungen einen Treffpunkt und eine Uhrzeit, damit der Reisende weiß, wohin.', es: 'Consejo: comparte un punto de encuentro y una hora desde tus reservas para que el viajero sepa adónde ir.', fr: 'Astuce : partage un point de rendez-vous et une heure depuis tes réservations pour que le voyageur sache où aller.' },
  'Delivery is late: {pkg}': { de: 'Lieferung verspätet: {pkg}', es: 'Entrega con retraso: {pkg}', fr: 'Livraison en retard : {pkg}' },
  '{pkg} was due on {date} and hasn\'t been delivered yet. You can wait, or cancel for a full refund from your dashboard.': { de: '{pkg} war am {date} fällig und wurde noch nicht geliefert. Du kannst warten oder in deinem Dashboard stornieren und bekommst alles zurück.', es: '{pkg} debía entregarse el {date} y aún no ha llegado. Puedes esperar o cancelar desde tu panel con reembolso completo.', fr: '{pkg} devait être livré le {date} et ne l\'est pas encore. Tu peux attendre, ou annuler depuis ton tableau de bord pour un remboursement intégral.' },
  'Overdue: {pkg}': { de: 'Überfällig: {pkg}', es: 'Retrasado: {pkg}', fr: 'En retard : {pkg}' },
  'This order was due on {date}. Please deliver as soon as possible — the client can now cancel for a full refund.': { de: 'Dieser Auftrag war am {date} fällig. Bitte liefere so schnell wie möglich — der Kunde kann jetzt mit voller Erstattung stornieren.', es: 'Este pedido debía entregarse el {date}. Entrégalo lo antes posible: el cliente ya puede cancelar con reembolso completo.', fr: 'Cette commande était à livrer le {date}. Livre-la au plus vite — le client peut désormais annuler avec remboursement intégral.' },
  'New message from {name}': { de: 'Neue Nachricht von {name}', es: 'Nuevo mensaje de {name}', fr: 'Nouveau message de {name}' },
  '{name} sent you a message on CapturaGo.': { de: '{name} hat dir auf CapturaGo geschrieben.', es: '{name} te ha enviado un mensaje en CapturaGo.', fr: '{name} t\'a envoyé un message sur CapturaGo.' },
  '{link} — or open the CapturaGo app.': { de: '{link} — oder öffne die CapturaGo-App.', es: '{link}, o abre la app de CapturaGo.', fr: '{link} — ou ouvre l\'app CapturaGo.' },
  'Read and reply': { de: 'Lesen und antworten', es: 'Leer y responder', fr: 'Lire et répondre' },
  'For your privacy we don\'t include messages in emails. Never pay outside CapturaGo — bookings paid on CapturaGo are protected.': { de: 'Zum Schutz deiner Privatsphäre stehen Nachrichten nicht in E-Mails. Zahle nie außerhalb von CapturaGo — über CapturaGo bezahlte Buchungen sind geschützt.', es: 'Por tu privacidad, no incluimos los mensajes en los correos. No pagues nunca fuera de CapturaGo: las reservas pagadas en CapturaGo están protegidas.', fr: 'Pour ta vie privée, nous n\'incluons pas les messages dans les e-mails. Ne paie jamais en dehors de CapturaGo — les réservations payées sur CapturaGo sont protégées.' },
  'Your photos will be deleted in 14 days — {pkg}': { de: 'Deine Fotos werden in 14 Tagen gelöscht — {pkg}', es: 'Tus fotos se eliminarán dentro de 14 días: {pkg}', fr: 'Tes photos seront supprimées dans 14 jours — {pkg}' },
  'Your photos from {pkg} are kept for 90 days. Please {link} within the next 14 days.': { de: 'Deine Fotos von {pkg} werden 90 Tage aufbewahrt. Bitte {link} in den nächsten 14 Tagen.', es: 'Tus fotos de {pkg} se conservan 90 días. Por favor, {link} en los próximos 14 días.', fr: 'Tes photos de {pkg} sont conservées 90 jours. Merci de {link} dans les 14 prochains jours.' },
  'download the ones you want to keep': { de: 'lade die herunter, die du behalten möchtest,', es: 'descarga las que quieras conservar', fr: 'télécharger celles que tu veux garder' },
  'A creator joined {city}': { de: 'Ein Creator ist jetzt in {city}', es: 'Un creador se ha unido en {city}', fr: 'Un créateur a rejoint {city}' },
  'You asked us to tell you when a creator joins {city}. {name} just did.': { de: 'Du wolltest Bescheid bekommen, wenn ein Creator in {city} dazukommt. {name} ist gerade dazugekommen.', es: 'Nos pediste que te avisáramos cuando un creador se uniera en {city}. {name} acaba de hacerlo.', fr: 'Tu nous as demandé de te prévenir quand un créateur rejoint {city}. {name} vient de le faire.' },
  '{link} — or browse everyone in {city} on {site}.': { de: '{link} — oder sieh dir alle in {city} auf {site} an.', es: '{link}, o mira a todos los de {city} en {site}.', fr: '{link} — ou découvre tout le monde à {city} sur {site}.' },
  'See their profile': { de: 'Profil ansehen', es: 'Ver su perfil', fr: 'Voir son profil' },
  'This was a one-time alert. You can follow other cities from the CapturaGo search.': { de: 'Das war eine einmalige Benachrichtigung. Weitere Städte kannst du in der CapturaGo-Suche verfolgen.', es: 'Era un aviso único. Puedes seguir otras ciudades desde la búsqueda de CapturaGo.', fr: 'C\'était une alerte unique. Tu peux suivre d\'autres villes depuis la recherche CapturaGo.' },
  '{name} is coming to {city}': { de: '{name} kommt nach {city}', es: '{name} viene a {city}', fr: '{name} vient à {city}' },
  'You asked us to tell you about creators in {city}. {name} will be there {when} and takes bookings for those days.': { de: 'Du wolltest über Creator in {city} informiert werden. {name} ist {when} dort und nimmt Buchungen für diese Tage an.', es: 'Nos pediste que te avisáramos de creadores en {city}. {name} estará allí {when} y acepta reservas para esos días.', fr: 'Tu nous as demandé de te prévenir des créateurs à {city}. {name} y sera {when} et accepte des réservations pour ces jours-là.' },
  'See their profile and book': { de: 'Profil ansehen und buchen', es: 'Ver su perfil y reservar', fr: 'Voir son profil et réserver' },
  '{name} is waiting for your reply': { de: '{name} wartet auf deine Antwort', es: '{name} espera tu respuesta', fr: '{name} attend ta réponse' },
  '{name} has been waiting about {n} hours for your answer on CapturaGo.': { de: '{name} wartet seit etwa {n} Stunden auf deine Antwort auf CapturaGo.', es: '{name} lleva unas {n} horas esperando tu respuesta en CapturaGo.', fr: '{name} attend ta réponse sur CapturaGo depuis environ {n} heures.' },
  '{link} — or open the CapturaGo app. Tip: save your usual answers as <strong>quick replies</strong>.': { de: '{link} — oder öffne die CapturaGo-App. Tipp: Speichere deine üblichen Antworten als <strong>Schnellantworten</strong>.', es: '{link}, o abre la app de CapturaGo. Consejo: guarda tus respuestas habituales como <strong>respuestas rápidas</strong>.', fr: '{link} — ou ouvre l\'app CapturaGo. Astuce : enregistre tes réponses habituelles comme <strong>réponses rapides</strong>.' },
  'Reply now': { de: 'Jetzt antworten', es: 'Responder ahora', fr: 'Répondre maintenant' },
  'Travellers see how quickly you usually reply on your profile. Fast answers win more bookings.': { de: 'Reisende sehen auf deinem Profil, wie schnell du meist antwortest. Schnelle Antworten bringen mehr Buchungen.', es: 'Los viajeros ven en tu perfil lo rápido que sueles responder. Las respuestas rápidas consiguen más reservas.', fr: 'Les voyageurs voient sur ton profil à quelle vitesse tu réponds d\'habitude. Les réponses rapides décrochent plus de réservations.' },
  'You get tips like this because you booked on CapturaGo. {link} (booking emails still arrive).': { de: 'Du bekommst solche Tipps, weil du auf CapturaGo gebucht hast. {link} (Buchungs-E-Mails kommen weiterhin).', es: 'Recibes consejos como este porque reservaste en CapturaGo. {link} (los correos de reservas seguirán llegando).', fr: 'Tu reçois ce genre de conseils car tu as réservé sur CapturaGo. {link} (les e-mails de réservation continuent d\'arriver).' },
  'Unsubscribe from tips &amp; reminders': { de: 'Tipps &amp; Erinnerungen abbestellen', es: 'Darse de baja de consejos y recordatorios', fr: 'Se désabonner des conseils &amp; rappels' },
  'How was your shoot with {name}?': { de: 'Wie war dein Shooting mit {name}?', es: '¿Qué tal tu sesión con {name}?', fr: 'Comment s\'est passé ton shooting avec {name} ?' },
  'We hope you love your photos from {pkg}. Would you tell other travellers how it was? It takes a minute and helps {name} a lot.': { de: 'Wir hoffen, du liebst deine Fotos von {pkg}. Erzählst du anderen Reisenden, wie es war? Es dauert eine Minute und hilft {name} sehr.', es: 'Esperamos que te encanten tus fotos de {pkg}. ¿Les cuentas a otros viajeros qué tal fue? Te llevará un minuto y ayuda mucho a {name}.', fr: 'Nous espérons que tu adores tes photos de {pkg}. Tu racontes aux autres voyageurs comment c\'était ? Ça prend une minute et aide beaucoup {name}.' },
  '{link} — you can add up to 3 of your photos.': { de: '{link} — du kannst bis zu 3 deiner Fotos hinzufügen.', es: '{link}: puedes añadir hasta 3 de tus fotos.', fr: '{link} — tu peux ajouter jusqu\'à 3 de tes photos.' },
  '⭐ Leave a review': { de: '⭐ Bewertung schreiben', es: '⭐ Dejar una reseña', fr: '⭐ Laisser un avis' },
  'A year ago in {city} 📸': { de: 'Vor einem Jahr in {city} 📸', es: 'Hace un año en {city} 📸', fr: 'Il y a un an à {city} 📸' },
  'A year ago today 📸': { de: 'Heute vor einem Jahr 📸', es: 'Hoy hace un año 📸', fr: 'Il y a un an jour pour jour 📸' },
  'One year ago you had your shoot in {city} with {name}. We hope the photos still make you smile.': { de: 'Vor einem Jahr hattest du dein Shooting in {city} mit {name}. Wir hoffen, die Fotos bringen dich immer noch zum Lächeln.', es: 'Hace un año tuviste tu sesión en {city} con {name}. Esperamos que las fotos te sigan sacando una sonrisa.', fr: 'Il y a un an, tu faisais ton shooting à {city} avec {name}. Nous espérons que les photos te font toujours sourire.' },
  'One year ago you had your shoot with {name}. We hope the photos still make you smile.': { de: 'Vor einem Jahr hattest du dein Shooting mit {name}. Wir hoffen, die Fotos bringen dich immer noch zum Lächeln.', es: 'Hace un año tuviste tu sesión con {name}. Esperamos que las fotos te sigan sacando una sonrisa.', fr: 'Il y a un an, tu faisais ton shooting avec {name}. Nous espérons que les photos te font toujours sourire.' },
  'Going back? {again}. Somewhere new? {free} in your next city.': { de: 'Du fährst wieder hin? {again}. Etwas Neues? {free} in deiner nächsten Stadt.', es: '¿Vuelves? {again}. ¿Un sitio nuevo? {free} en tu próxima ciudad.', fr: 'Tu y retournes ? {again}. Une nouvelle destination ? {free} dans ta prochaine ville.' },
  'Book {name} again': { de: '{name} wieder buchen', es: 'Reserva de nuevo a {name}', fr: 'Réserve à nouveau {name}' },
  'See who\'s free on your dates': { de: 'Sieh, wer an deinen Tagen frei ist', es: 'Mira quién está libre en tus fechas', fr: 'Vois qui est libre à tes dates' },
  'Photos for {name} are due': { de: 'Die Fotos für {name} sind fällig', es: 'Las fotos de {name} deben entregarse', fr: 'Les photos de {name} sont attendues' },
  'Your package {pkg} promises the photos within {n} days of the shoot ({date}). Please upload and send them in your bookings — your client is waiting.': { de: 'Dein Paket {pkg} verspricht die Fotos innerhalb von {n} Tagen nach dem Shooting ({date}). Bitte lade sie in deinen Buchungen hoch und schick sie — dein Kunde wartet.', es: 'Tu paquete {pkg} promete las fotos en {n} días desde la sesión ({date}). Súbelas y envíalas desde tus reservas: tu cliente está esperando.', fr: 'Ton forfait {pkg} promet les photos sous {n} jours après le shooting ({date}). Ajoute-les et envoie-les depuis tes réservations — ton client attend.' },
  'Your package {pkg} promises the photos within {n} day of the shoot ({date}). Please upload and send them in your bookings — your client is waiting.': { de: 'Dein Paket {pkg} verspricht die Fotos innerhalb von {n} Tag nach dem Shooting ({date}). Bitte lade sie in deinen Buchungen hoch und schick sie — dein Kunde wartet.', es: 'Tu paquete {pkg} promete las fotos en {n} día desde la sesión ({date}). Súbelas y envíalas desde tus reservas: tu cliente está esperando.', fr: 'Ton forfait {pkg} promet les photos sous {n} jour après le shooting ({date}). Ajoute-les et envoie-les depuis tes réservations — ton client attend.' },
  'Your payment is released 3 days after you send them.': { de: 'Deine Zahlung wird 3 Tage nach dem Senden ausgezahlt.', es: 'Tu pago se libera 3 días después de enviarlas.', fr: 'Ton paiement est versé 3 jours après leur envoi.' },
  'Your photos are late — {pkg}': { de: 'Deine Fotos sind verspätet — {pkg}', es: 'Tus fotos llegan tarde: {pkg}', fr: 'Tes photos sont en retard — {pkg}' },
  'Your photos from {pkg} were promised by {date} and haven\'t arrived yet. <strong>Your payment is still on hold</strong> — nothing goes to the creator until you have them.': { de: 'Deine Fotos von {pkg} waren bis {date} versprochen und sind noch nicht da. <strong>Deine Zahlung ist weiter zurückgehalten</strong> — der Creator bekommt nichts, bevor du sie hast.', es: 'Tus fotos de {pkg} se prometieron para el {date} y aún no han llegado. <strong>Tu pago sigue retenido</strong>: el creador no recibe nada hasta que las tengas.', fr: 'Tes photos de {pkg} étaient promises pour le {date} et ne sont pas encore arrivées. <strong>Ton paiement reste bloqué</strong> — le créateur ne reçoit rien tant que tu ne les as pas.' },
  'Message your creator on CapturaGo, or {link} and we\'ll step in.': { de: 'Schreib deinem Creator auf CapturaGo oder {link} und wir greifen ein.', es: 'Escribe a tu creador en CapturaGo o {link} e intervendremos.', fr: 'Écris à ton créateur sur CapturaGo, ou {link} et nous intervenons.' },
  'report a problem': { de: 'melde ein Problem', es: 'comunica un problema', fr: 'signale un problème' },

  // shoot requests
  'New shoot request in {city} ({when})': { de: 'Neue Shooting-Anfrage in {city} ({when})', es: 'Nueva solicitud de sesión en {city} ({when})', fr: 'Nouvelle demande de shooting à {city} ({when})' },
  '{name} is looking for a {service} in {city}, {when}': { de: '{name} sucht {service} in {city}, {when}', es: '{name} busca {service} en {city}, {when}', fr: '{name} cherche un {service} à {city}, {when}' },
  '{n} person': { de: '{n} Person', es: '{n} persona', fr: '{n} personne' },
  '{n} people': { de: '{n} Personen', es: '{n} personas', fr: '{n} personnes' },
  'budget about €{n}': { de: 'Budget etwa €{n}', es: 'presupuesto de unos €{n}', fr: 'budget d\'environ €{n}' },
  '{link} — the first good offers usually get booked.': { de: '{link} — die ersten guten Angebote werden meist gebucht.', es: '{link}: las primeras buenas ofertas suelen reservarse.', fr: '{link} — les premières bonnes offres sont généralement réservées.' },
  'Send an offer': { de: 'Angebot senden', es: 'Enviar una oferta', fr: 'Envoyer une offre' },
  'A new offer for your shoot in {city}': { de: 'Ein neues Angebot für dein Shooting in {city}', es: 'Una nueva oferta para tu sesión en {city}', fr: 'Une nouvelle offre pour ton shooting à {city}' },
  '{n} new offers for your shoot in {city}': { de: '{n} neue Angebote für dein Shooting in {city}', es: '{n} nuevas ofertas para tu sesión en {city}', fr: '{n} nouvelles offres pour ton shooting à {city}' },
  'A creator has sent you an offer for your shoot request in {city}.': { de: 'Ein Creator hat dir ein Angebot für deine Shooting-Anfrage in {city} geschickt.', es: 'Un creador te ha enviado una oferta para tu solicitud de sesión en {city}.', fr: 'Un créateur t\'a envoyé une offre pour ta demande de shooting à {city}.' },
  '{n} creators have sent you an offer for your shoot request in {city}.': { de: '{n} Creator haben dir ein Angebot für deine Shooting-Anfrage in {city} geschickt.', es: '{n} creadores te han enviado una oferta para tu solicitud de sesión en {city}.', fr: '{n} créateurs t\'ont envoyé une offre pour ta demande de shooting à {city}.' },
  '{link} — you can message the creators before you book.': { de: '{link} — du kannst den Creatorn vor dem Buchen schreiben.', es: '{link}: puedes escribir a los creadores antes de reservar.', fr: '{link} — tu peux écrire aux créateurs avant de réserver.' },
  'Compare the offers': { de: 'Angebote vergleichen', es: 'Comparar las ofertas', fr: 'Comparer les offres' },

  // invites
  '🚀 Your first booking is done — enjoy a free boost': { de: '🚀 Deine erste Buchung ist abgeschlossen — genieße einen gratis Boost', es: '🚀 Tu primera reserva está completada: disfruta de un impulso gratis', fr: '🚀 Ta première réservation est terminée — profite d\'un boost gratuit' },
  'Congratulations on your first completed booking on CapturaGo! As a thank-you for joining through {name}’s invite, your listing is boosted to the top of the results for {n} days (until {until}).': { de: 'Glückwunsch zu deiner ersten abgeschlossenen Buchung auf CapturaGo! Als Dankeschön, dass du über die Einladung von {name} dabei bist, steht dein Profil {n} Tage lang oben in den Ergebnissen (bis {until}).', es: '¡Enhorabuena por tu primera reserva completada en CapturaGo! Como agradecimiento por unirte con la invitación de {name}, tu perfil aparece arriba en los resultados durante {n} días (hasta el {until}).', fr: 'Félicitations pour ta première réservation terminée sur CapturaGo ! Pour te remercier d\'avoir rejoint CapturaGo grâce à l\'invitation de {name}, ton profil est mis en avant en haut des résultats pendant {n} jours (jusqu\'au {until}).' },
  'Congratulations on your first completed booking on CapturaGo! As a thank-you for joining through an invite, your listing is boosted to the top of the results for {n} days (until {until}).': { de: 'Glückwunsch zu deiner ersten abgeschlossenen Buchung auf CapturaGo! Als Dankeschön, dass du über eine Einladung dabei bist, steht dein Profil {n} Tage lang oben in den Ergebnissen (bis {until}).', es: '¡Enhorabuena por tu primera reserva completada en CapturaGo! Como agradecimiento por unirte con una invitación, tu perfil aparece arriba en los resultados durante {n} días (hasta el {until}).', fr: 'Félicitations pour ta première réservation terminée sur CapturaGo ! Pour te remercier d\'avoir rejoint CapturaGo grâce à une invitation, ton profil est mis en avant en haut des résultats pendant {n} jours (jusqu\'au {until}).' },
  'A creator you invited': { de: 'Ein Creator, den du eingeladen hast,', es: 'Un creador al que invitaste', fr: 'Un créateur que tu as invité' },
  '🚀 {name} completed their first booking — free boost for you': { de: '🚀 {name} hat die erste Buchung abgeschlossen — gratis Boost für dich', es: '🚀 {name} completó su primera reserva: impulso gratis para ti', fr: '🚀 {name} a terminé sa première réservation — boost gratuit pour toi' },
  '{name} just completed their first booking on CapturaGo. Thank you for inviting them — your listing is boosted for {n} days (until {until}).': { de: '{name} hat gerade die erste Buchung auf CapturaGo abgeschlossen. Danke für die Einladung — dein Profil wird {n} Tage lang hervorgehoben (bis {until}).', es: '{name} acaba de completar su primera reserva en CapturaGo. Gracias por invitarle: tu perfil está destacado durante {n} días (hasta el {until}).', fr: '{name} vient de terminer sa première réservation sur CapturaGo. Merci de l\'avoir invité — ton profil est mis en avant pendant {n} jours (jusqu\'au {until}).' },
  'Know more great creators? {link}.': { de: 'Kennst du weitere tolle Creator? {link}.', es: '¿Conoces a más creadores geniales? {link}.', fr: 'Tu connais d\'autres super créateurs ? {link}.' },
  'Share your invite link': { de: 'Teile deinen Einladungslink', es: 'Comparte tu enlace de invitación', fr: 'Partage ton lien d\'invitation' },

  // gift cards + split payments
  'Your CapturaGo gift card ({amount})': { de: 'Dein CapturaGo-Gutschein ({amount})', es: 'Tu tarjeta regalo de CapturaGo ({amount})', fr: 'Ta carte cadeau CapturaGo ({amount})' },
  'Thank you! Here is your gift card for {amount} for {name}:': { de: 'Danke! Hier ist dein Gutschein über {amount} für {name}:', es: '¡Gracias! Aquí tienes tu tarjeta regalo de {amount} para {name}:', fr: 'Merci ! Voici ta carte cadeau de {amount} pour {name} :' },
  'Thank you! Here is your gift card for {amount}:': { de: 'Danke! Hier ist dein Gutschein über {amount}:', es: '¡Gracias! Aquí tienes tu tarjeta regalo de {amount}:', fr: 'Merci ! Voici ta carte cadeau de {amount} :' },
  'It can be used for any shoot on CapturaGo until {date} — enter the code when booking. {link}.': { de: 'Er gilt für jedes Shooting auf CapturaGo bis {date} — gib den Code beim Buchen ein. {link}.', es: 'Se puede usar en cualquier sesión de CapturaGo hasta el {date}: introduce el código al reservar. {link}.', fr: 'Elle est valable pour tout shooting sur CapturaGo jusqu\'au {date} — saisis le code lors de la réservation. {link}.' },
  'Download a printable card': { de: 'Druckbare Karte herunterladen', es: 'Descargar una tarjeta para imprimir', fr: 'Télécharger une carte à imprimer' },
  'We\'ve also emailed it to {email}.': { de: 'Wir haben ihn auch an {email} geschickt.', es: 'También la hemos enviado a {email}.', fr: 'Nous l\'avons aussi envoyée à {email}.' },
  '🎁 You\'ve got a CapturaGo gift card': { de: '🎁 Du hast einen CapturaGo-Gutschein bekommen', es: '🎁 Te han regalado una tarjeta regalo de CapturaGo', fr: '🎁 Tu as reçu une carte cadeau CapturaGo' },
  'Someone gave you a photo shoot! Here is your CapturaGo gift card for {amount}:': { de: 'Jemand schenkt dir ein Fotoshooting! Hier ist dein CapturaGo-Gutschein über {amount}:', es: '¡Alguien te ha regalado una sesión de fotos! Aquí tienes tu tarjeta regalo de CapturaGo de {amount}:', fr: 'Quelqu\'un t\'offre un shooting photo ! Voici ta carte cadeau CapturaGo de {amount} :' },
  'Find a photographer, videographer or local guide wherever you travel on {site} and enter the code when you book. Valid until {date}.': { de: 'Finde auf {site} Fotografen, Videografen oder lokale Guides, wohin du auch reist, und gib den Code beim Buchen ein. Gültig bis {date}.', es: 'Encuentra un fotógrafo, videógrafo o guía local allá donde viajes en {site} e introduce el código al reservar. Válida hasta el {date}.', fr: 'Trouve un photographe, un vidéaste ou un guide local partout où tu voyages sur {site} et saisis le code lors de la réservation. Valable jusqu\'au {date}.' },
  'The booking you paid a share of ({pkg}) is no longer open, so we refunded your payment in full. It can take 5–10 days to appear.': { de: 'Die Buchung, für die du einen Anteil bezahlt hast ({pkg}), ist nicht mehr offen, deshalb haben wir deine Zahlung vollständig erstattet. Das kann 5–10 Tage dauern.', es: 'La reserva de la que pagaste una parte ({pkg}) ya no está abierta, así que te hemos reembolsado el pago completo. Puede tardar entre 5 y 10 días en aparecer.', fr: 'La réservation dont tu as payé une part ({pkg}) n\'est plus ouverte : nous t\'avons remboursé intégralement. Cela peut prendre 5 à 10 jours.' },
  'a CapturaGo booking': { de: 'eine CapturaGo-Buchung', es: 'una reserva de CapturaGo', fr: 'une réservation CapturaGo' },
  'Share {n}': { de: 'Anteil {n}', es: 'Parte {n}', fr: 'Part {n}' },
  'Send your friends their payment links — {pkg}': { de: 'Schick deinen Freunden ihre Zahlungslinks — {pkg}', es: 'Envía a tus amigos sus enlaces de pago: {pkg}', fr: 'Envoie à tes amis leurs liens de paiement — {pkg}' },
  'Your share is paid. Send each friend one of these links — every link can be paid once:': { de: 'Dein Anteil ist bezahlt. Schick jeder Person einen dieser Links — jeder Link kann einmal bezahlt werden:', es: 'Tu parte está pagada. Envía a cada amigo uno de estos enlaces; cada enlace se puede pagar una vez:', fr: 'Ta part est payée. Envoie à chaque ami un de ces liens — chaque lien peut être payé une fois :' },
  'Everyone needs to pay by {time}. If someone doesn\'t, everyone is refunded automatically and the day is released.': { de: 'Alle müssen bis {time} bezahlen. Zahlt jemand nicht, bekommen alle automatisch ihr Geld zurück und der Tag wird freigegeben.', es: 'Todos deben pagar antes de {time}. Si alguien no paga, se reembolsa a todos automáticamente y se libera el día.', fr: 'Tout le monde doit payer avant {time}. Si quelqu\'un ne paie pas, tout le monde est remboursé automatiquement et la journée est libérée.' },
  'You can also find the links in {link}.': { de: 'Die Links findest du auch in {link}.', es: 'También encontrarás los enlaces en {link}.', fr: 'Tu trouves aussi les liens dans {link}.' },

  // founding creators, refunds, partners (admin panel)
  '<strong>{n} founding creator spots</strong>': { de: '<strong>{n} Gründer-Plätze</strong>', es: '<strong>{n} plazas de creador fundador</strong>', fr: '<strong>{n} places de créateur fondateur</strong>' },
  'Founding creator spots are open in {city}': { de: 'Gründer-Plätze für Creator in {city} sind offen', es: 'Plazas de creador fundador abiertas en {city}', fr: 'Places de créateur fondateur ouvertes à {city}' },
  'We\'re opening {spots} in {city}. Founding creators get a 🏅 badge on their profile and a <strong>free {n}-day boost</strong> to the top of the results.': { de: 'Wir öffnen {spots} in {city}. Gründer-Creator bekommen ein 🏅-Abzeichen im Profil und einen <strong>gratis Boost für {n} Tage</strong> an die Spitze der Ergebnisse.', es: 'Abrimos {spots} en {city}. Los creadores fundadores reciben una insignia 🏅 en su perfil y un <strong>impulso gratis de {n} días</strong> a lo más alto de los resultados.', fr: 'Nous ouvrons {spots} à {city}. Les créateurs fondateurs reçoivent un badge 🏅 sur leur profil et un <strong>boost gratuit de {n} jours</strong> en haut des résultats.' },
  'We\'re opening {spots} in {city}. Founding creators get a 🏅 badge on their profile.': { de: 'Wir öffnen {spots} in {city}. Gründer-Creator bekommen ein 🏅-Abzeichen im Profil.', es: 'Abrimos {spots} en {city}. Los creadores fundadores reciben una insignia 🏅 en su perfil.', fr: 'Nous ouvrons {spots} à {city}. Les créateurs fondateurs reçoivent un badge 🏅 sur leur profil.' },
  'To claim yours: finish your listing (a cover photo, at least 3 portfolio photos, one package and a description), then press <strong>Claim my spot</strong> in your dashboard.': { de: 'So sicherst du dir deinen: Vervollständige dein Profil (ein Titelbild, mindestens 3 Portfoliofotos, ein Paket und eine Beschreibung) und tippe dann in deinem Dashboard auf <strong>Meinen Platz sichern</strong>.', es: 'Para conseguir la tuya: completa tu perfil (una foto de portada, al menos 3 fotos de portafolio, un paquete y una descripción) y pulsa <strong>Reclamar mi plaza</strong> en tu panel.', fr: 'Pour obtenir la tienne : complète ton profil (une photo de couverture, au moins 3 photos de portfolio, un forfait et une description), puis appuie sur <strong>Réclamer ma place</strong> dans ton tableau de bord.' },
  'First come, first served. One spot per person.': { de: 'Wer zuerst kommt, mahlt zuerst. Ein Platz pro Person.', es: 'Por orden de llegada. Una plaza por persona.', fr: 'Premier arrivé, premier servi. Une place par personne.' },
  'Refund issued: {pkg}': { de: 'Erstattung veranlasst: {pkg}', es: 'Reembolso emitido: {pkg}', fr: 'Remboursement effectué : {pkg}' },
  'We\'ve refunded {amount} for {pkg}. It can take 5–10 days to appear.': { de: 'Wir haben {amount} für {pkg} erstattet. Das kann 5–10 Tage dauern.', es: 'Hemos reembolsado {amount} por {pkg}. Puede tardar entre 5 y 10 días en aparecer.', fr: 'Nous avons remboursé {amount} pour {pkg}. Cela peut prendre 5 à 10 jours.' },
  'Gift card refunded': { de: 'Gutschein erstattet', es: 'Tarjeta regalo reembolsada', fr: 'Carte cadeau remboursée' },
  'We\'ve refunded your CapturaGo gift card ({amount}). The code no longer works. The refund can take 5–10 days to appear.': { de: 'Wir haben deinen CapturaGo-Gutschein erstattet ({amount}). Der Code funktioniert nicht mehr. Die Erstattung kann 5–10 Tage dauern.', es: 'Hemos reembolsado tu tarjeta regalo de CapturaGo ({amount}). El código ya no funciona. El reembolso puede tardar entre 5 y 10 días en aparecer.', fr: 'Nous avons remboursé ta carte cadeau CapturaGo ({amount}). Le code ne fonctionne plus. Le remboursement peut prendre 5 à 10 jours.' },
  'Welcome to the CapturaGo partner program': { de: 'Willkommen im CapturaGo-Partnerprogramm', es: 'Bienvenido al programa de socios de CapturaGo', fr: 'Bienvenue dans le programme partenaires CapturaGo' },
  '{name} is now a CapturaGo partner. Your guests get a lower service fee when they book through your link, and you get a 3% thank-you of the package price for every completed shoot.': { de: '{name} ist jetzt CapturaGo-Partner. Deine Gäste zahlen eine niedrigere Servicegebühr, wenn sie über deinen Link buchen, und du bekommst für jedes abgeschlossene Shooting 3 % des Paketpreises als Dankeschön.', es: '{name} ya es socio de CapturaGo. Tus huéspedes pagan una comisión de servicio más baja cuando reservan con tu enlace, y tú recibes un 3 % del precio del paquete como agradecimiento por cada sesión completada.', fr: '{name} est désormais partenaire CapturaGo. Tes clients paient des frais de service réduits lorsqu\'ils réservent via ton lien, et tu reçois 3 % du prix du forfait en remerciement pour chaque shooting terminé.' },
  'Your link: {link}': { de: 'Dein Link: {link}', es: 'Tu enlace: {link}', fr: 'Ton lien : {link}' },
  'Print your QR card and see your bookings on {page}.': { de: 'Drucke deine QR-Karte und sieh deine Buchungen auf {page}.', es: 'Imprime tu tarjeta QR y consulta tus reservas en {page}.', fr: 'Imprime ta carte QR et consulte tes réservations sur {page}.' },
  'your partner page': { de: 'deiner Partnerseite', es: 'tu página de socio', fr: 'ta page partenaire' },
  'Your CapturaGo partner application': { de: 'Deine Bewerbung als CapturaGo-Partner', es: 'Tu solicitud de socio de CapturaGo', fr: 'Ta candidature de partenaire CapturaGo' },
  'Thank you for applying. We can\'t add {name} as a partner right now. You can apply again in 30 days, or reply to this email if you have questions.': { de: 'Danke für deine Bewerbung. Wir können {name} gerade nicht als Partner aufnehmen. Du kannst dich in 30 Tagen erneut bewerben oder bei Fragen auf diese E-Mail antworten.', es: 'Gracias por tu solicitud. Ahora mismo no podemos añadir {name} como socio. Puedes volver a solicitarlo en 30 días o responder a este correo si tienes preguntas.', fr: 'Merci pour ta candidature. Nous ne pouvons pas ajouter {name} comme partenaire pour le moment. Tu peux postuler à nouveau dans 30 jours, ou répondre à cet e-mail si tu as des questions.' },

  // last-minute deals (v8.13)
  '⚡ Last-minute in {city}: {name} −{pct}% on {date}': { de: '⚡ Last-Minute in {city}: {name} −{pct} % am {date}', es: '⚡ Última hora en {city}: {name} −{pct} % el {date}', fr: '⚡ Dernière minute à {city} : {name} −{pct} % le {date}' },
  '{name} is free on {date} in {city} and lowered the price by {pct}% for that day.': { de: '{name} ist am {date} in {city} frei und hat den Preis für diesen Tag um {pct} % gesenkt.', es: '{name} está libre el {date} en {city} y ha bajado el precio un {pct} % para ese día.', fr: '{name} est libre le {date} à {city} et a baissé son prix de {pct} % pour ce jour-là.' },
  '{link} — the lower price is for that day only, and the payment is protected as always.': { de: '{link} — der niedrigere Preis gilt nur für diesen Tag, und die Zahlung ist wie immer geschützt.', es: '{link}: el precio rebajado es solo para ese día y el pago está protegido como siempre.', fr: '{link} — le prix réduit vaut pour ce jour uniquement, et le paiement est protégé comme toujours.' },
  'See the profile and book': { de: 'Profil ansehen und buchen', es: 'Ver el perfil y reservar', fr: 'Voir le profil et réserver' },
  'You get this because you\'re in {city} around these days (a booking, a shoot request or a city you follow). We send at most one deal a day.': { de: 'Du bekommst das, weil du um diese Tage in {city} bist (eine Buchung, eine Shooting-Anfrage oder eine Stadt, der du folgst). Wir schicken höchstens ein Angebot pro Tag.', es: 'Recibes esto porque estás en {city} estos días (una reserva, una solicitud de sesión o una ciudad que sigues). Enviamos como máximo una oferta al día.', fr: 'Tu reçois ce message car tu es à {city} ces jours-ci (une réservation, une demande de shooting ou une ville que tu suis). Nous envoyons au plus une offre par jour.' },
  '{link} (booking emails still arrive).': { de: '{link} (Buchungs-E-Mails kommen weiterhin).', es: '{link} (los correos de reservas seguirán llegando).', fr: '{link} (les e-mails de réservation continuent d\'arriver).' },
  'Unsubscribe from deals, tips &amp; reminders': { de: 'Angebote, Tipps &amp; Erinnerungen abbestellen', es: 'Darse de baja de ofertas, consejos y recordatorios', fr: 'Se désabonner des offres, conseils &amp; rappels' },
  '⚡ Booked at your last-minute price (−{n}%).': { de: '⚡ Zu deinem Last-Minute-Preis gebucht (−{n} %).', es: '⚡ Reservado a tu precio de última hora (−{n} %).', fr: '⚡ Réservé à ton prix de dernière minute (−{n} %).' },

  // text messages (v8.13)
  'Your CapturaGo code: {code}. It expires in 10 minutes. Never share it with anyone.': { de: 'Dein CapturaGo-Code: {code}. Er läuft in 10 Minuten ab. Gib ihn niemandem weiter.', es: 'Tu código de CapturaGo: {code}. Caduca en 10 minutos. No lo compartas con nadie.', fr: 'Ton code CapturaGo : {code}. Il expire dans 10 minutes. Ne le partage avec personne.' },
  'today': { de: 'heute', es: 'hoy', fr: "aujourd'hui" },
  'tomorrow': { de: 'morgen', es: 'mañana', fr: 'demain' },
  'at {time}': { de: 'um {time}', es: 'a las {time}', fr: 'à {time}' },
  'not shared yet — message each other in CapturaGo': { de: 'noch nicht geteilt — schreibt euch in CapturaGo', es: 'aún sin compartir: escribíos en CapturaGo', fr: 'pas encore partagé — écrivez-vous sur CapturaGo' },
  'your plans {when} {time}': { de: 'deine Pläne {when} {time}', es: 'tus planes de {when} {time}', fr: 'tes projets {when} {time}' },
  'your shoot with {name} {when} {time}': { de: 'dein Shooting mit {name} {when} {time}', es: 'tu sesión con {name} {when} {time}', fr: 'ton shooting avec {name} {when} {time}' },
  'CapturaGo reminder: {what}. Details: {link}': { de: 'CapturaGo-Erinnerung: {what}. Details: {link}', es: 'Recordatorio de CapturaGo: {what}. Detalles: {link}', fr: 'Rappel CapturaGo : {what}. Détails : {link}' },
  'CapturaGo reminder: {what}. Meeting point: {place}. Details: {link}': { de: 'CapturaGo-Erinnerung: {what}. Treffpunkt: {place}. Details: {link}', es: 'Recordatorio de CapturaGo: {what}. Punto de encuentro: {place}. Detalles: {link}', fr: 'Rappel CapturaGo : {what}. Point de rendez-vous : {place}. Détails : {link}' },

  // weather-aware reminders, "notify me" on a creator, "Surprise me" gift cards (v8.14)
  '🌧 <strong>Heavy rain is forecast</strong> for the shoot day{detail}.': { de: '🌧 Für den Shooting-Tag ist <strong>starker Regen vorhergesagt</strong>{detail}.', es: '🌧 Se prevé <strong>lluvia fuerte</strong> para el día de la sesión{detail}.', fr: '🌧 De <strong>fortes pluies sont prévues</strong> le jour du shooting{detail}.' },
  ' ({pct}% chance of rain)': { de: ' ({pct} % Regenwahrscheinlichkeit)', es: ' ({pct} % de probabilidad de lluvia)', fr: ' ({pct} % de risque de pluie)' },
  'Want to move it? {link} — moving is free if you both agree, and the other person is asked right away.': { de: 'Lieber verschieben? {link} — Verschieben ist kostenlos, wenn ihr beide zustimmt, und die andere Person wird sofort gefragt.', es: '¿Quieres moverla? {link}: cambiarla es gratis si estáis de acuerdo, y se le pregunta a la otra persona enseguida.', fr: 'Tu veux le déplacer ? {link} — c\'est gratuit si vous êtes d\'accord tous les deux, et l\'autre personne est prévenue tout de suite.' },
  '📅 Propose a new date': { de: '📅 Neuen Termin vorschlagen', es: '📅 Proponer otra fecha', fr: '📅 Proposer une nouvelle date' },
  'Your shoot is tomorrow — heavy rain forecast: {pkg}': { de: 'Dein Shooting ist morgen — starker Regen vorhergesagt: {pkg}', es: 'Tu sesión es mañana, con lluvia fuerte prevista: {pkg}', fr: 'Ton shooting est demain — fortes pluies prévues : {pkg}' },
  'Shoot tomorrow — heavy rain forecast: {pkg}': { de: 'Shooting morgen — starker Regen vorhergesagt: {pkg}', es: 'Sesión mañana, con lluvia fuerte prevista: {pkg}', fr: 'Shooting demain — fortes pluies prévues : {pkg}' },
  'heavy rain forecast; to move it, tap the link': { de: 'starker Regen vorhergesagt; zum Verschieben auf den Link tippen', es: 'se prevé lluvia fuerte; para cambiarla, toca el enlace', fr: 'fortes pluies prévues ; pour le déplacer, touche le lien' },
  '⚡ {name} has a last-minute deal: −{pct}% on {date}': { de: '⚡ {name} hat ein Last-Minute-Angebot: −{pct} % am {date}', es: '⚡ {name} tiene una oferta de última hora: −{pct} % el {date}', fr: '⚡ {name} a une offre de dernière minute : −{pct} % le {date}' },
  '🔔 {name} has a free day again': { de: '🔔 {name} hat wieder einen freien Tag', es: '🔔 {name} vuelve a tener un día libre', fr: '🔔 {name} a de nouveau un jour libre' },
  'You asked us to tell you when {name} has something for you. They just lowered their price by {pct}% for {date}.': { de: 'Du wolltest Bescheid bekommen, wenn {name} etwas für dich hat. Gerade wurde der Preis für {date} um {pct} % gesenkt.', es: 'Nos pediste que te avisáramos cuando {name} tuviera algo para ti. Acaba de bajar su precio un {pct} % para el {date}.', fr: 'Tu nous as demandé de te prévenir quand {name} aurait quelque chose pour toi. Le prix vient de baisser de {pct} % pour le {date}.' },
  'You asked us to tell you when {name} has a free day. {n} days just opened up — the first is {date}.': { de: 'Du wolltest Bescheid bekommen, wenn {name} einen freien Tag hat. Gerade sind {n} Tage frei geworden — der erste ist {date}.', es: 'Nos pediste que te avisáramos cuando {name} tuviera un día libre. Acaban de quedar libres {n} días; el primero es el {date}.', fr: 'Tu nous as demandé de te prévenir quand {name} aurait un jour libre. {n} jours viennent de se libérer — le premier est le {date}.' },
  'You asked us to tell you when {name} has a free day. {date} just opened up.': { de: 'Du wolltest Bescheid bekommen, wenn {name} einen freien Tag hat. {date} ist gerade frei geworden.', es: 'Nos pediste que te avisáramos cuando {name} tuviera un día libre. Acaba de quedar libre el {date}.', fr: 'Tu nous as demandé de te prévenir quand {name} aurait un jour libre. Le {date} vient de se libérer.' },
  '{link} — free days go quickly, and the payment is protected as always.': { de: '{link} — freie Tage sind schnell weg, und die Zahlung ist wie immer geschützt.', es: '{link}: los días libres vuelan, y el pago está protegido como siempre.', fr: '{link} — les jours libres partent vite, et le paiement est protégé comme toujours.' },
  'Book {name}': { de: '{name} buchen', es: 'Reservar con {name}', fr: 'Réserver {name}' },
  'This was a one-time alert. Watch again any time from {link}.': { de: 'Das war eine einmalige Benachrichtigung. Du kannst jederzeit wieder über {link} folgen.', es: 'Era un aviso único. Puedes volver a activarlo cuando quieras desde {link}.', fr: 'C\'était une alerte unique. Tu peux la réactiver à tout moment depuis {link}.' },
  '{name}’s profile': { de: 'dem Profil von {name}', es: 'el perfil de {name}', fr: 'le profil de {name}' },
  'CapturaGo: {name} has a last-minute deal, −{pct}% on {date}. Book: {link}': { de: 'CapturaGo: {name} hat ein Last-Minute-Angebot, −{pct} % am {date}. Buchen: {link}', es: 'CapturaGo: {name} tiene una oferta de última hora, −{pct} % el {date}. Reserva: {link}', fr: 'CapturaGo : {name} a une offre de dernière minute, −{pct} % le {date}. Réserver : {link}' },
  'CapturaGo: {name} has a free day again ({date}). Book: {link}': { de: 'CapturaGo: {name} hat wieder einen freien Tag ({date}). Buchen: {link}', es: 'CapturaGo: {name} vuelve a tener un día libre ({date}). Reserva: {link}', fr: 'CapturaGo : {name} a de nouveau un jour libre ({date}). Réserver : {link}' },
  '🎲 It\'s a “Surprise me” gift: they can let us pick a last-minute deal for them on {link}.': { de: '🎲 Es ist ein „Überrasch mich“-Gutschein: Sie können uns auf {link} ein Last-Minute-Angebot für sich aussuchen lassen.', es: '🎲 Es un regalo «Sorpréndeme»: puede dejar que elijamos una oferta de última hora en {link}.', fr: '🎲 C\'est un cadeau « Surprends-moi » : la personne peut nous laisser choisir une offre de dernière minute sur {link}.' },
  'the deals page': { de: 'der Angebotsseite', es: 'la página de ofertas', fr: 'la page des offres' },
  '🎲 <strong>Feeling spontaneous?</strong> This is a “Surprise me” gift: {link}, press “Surprise me” and we pick a last-minute shoot for you — often at a lower price.': { de: '🎲 <strong>Lust auf Spontanes?</strong> Das ist ein „Überrasch mich“-Gutschein: {link}, tippe auf „Überrasch mich“, und wir suchen ein Last-Minute-Shooting für dich aus — oft günstiger.', es: '🎲 <strong>¿Te apetece algo espontáneo?</strong> Es un regalo «Sorpréndeme»: {link}, pulsa «Sorpréndeme» y elegimos una sesión de última hora para ti, a menudo más barata.', fr: '🎲 <strong>Envie de spontanéité ?</strong> C\'est un cadeau « Surprends-moi » : {link}, appuie sur « Surprends-moi » et on choisit un shooting de dernière minute pour toi — souvent moins cher.' },
  'open the last-minute deals': { de: 'öffne die Last-Minute-Angebote', es: 'abre las ofertas de última hora', fr: 'ouvre les offres de dernière minute' },
  'It also works for last-minute deals: {link}.': { de: 'Er gilt auch für Last-Minute-Angebote: {link}.', es: 'También sirve para ofertas de última hora: {link}.', fr: 'Elle fonctionne aussi pour les offres de dernière minute : {link}.' },
  'see who has a lower price tomorrow': { de: 'sieh nach, wer morgen günstiger ist', es: 'mira quién tiene un precio más bajo mañana', fr: 'vois qui est moins cher demain' },

  // EU DAC7 tax details and the yearly statement (v8.15)
  'Add my tax details': { de: 'Meine Steuerdaten hinzufügen', es: 'Añadir mis datos fiscales', fr: 'Ajouter mes informations fiscales' },
  'Please add your tax details for CapturaGo': { de: 'Bitte ergänze deine Steuerdaten für CapturaGo', es: 'Añade tus datos fiscales para CapturaGo', fr: 'Merci d\'ajouter tes informations fiscales pour CapturaGo' },
  'Reminder: your tax details for CapturaGo are still missing': { de: 'Erinnerung: Deine Steuerdaten für CapturaGo fehlen noch', es: 'Recordatorio: aún faltan tus datos fiscales para CapturaGo', fr: 'Rappel : il manque encore tes informations fiscales pour CapturaGo' },
  'EU law (the DAC7 directive) requires platforms like CapturaGo to collect the tax details of everyone who earns money through them, and to report those earnings to the tax authority once a year. You also get a copy of what we report.': { de: 'Das EU-Recht (die DAC7-Richtlinie) verpflichtet Plattformen wie CapturaGo, die Steuerdaten aller zu erfassen, die über sie Geld verdienen, und diese Einnahmen einmal im Jahr an die Steuerbehörde zu melden. Du bekommst eine Kopie dessen, was wir melden.', es: 'La ley de la UE (la directiva DAC7) obliga a plataformas como CapturaGo a recoger los datos fiscales de quienes ganan dinero a través de ellas y a comunicar esos ingresos a la autoridad tributaria una vez al año. Recibirás una copia de lo que comunicamos.', fr: 'Le droit européen (la directive DAC7) oblige les plateformes comme CapturaGo à collecter les informations fiscales de toutes les personnes qui gagnent de l\'argent grâce à elles, et à déclarer ces revenus à l\'administration fiscale une fois par an. Tu reçois une copie de ce que nous déclarons.' },
  'It takes about two minutes: {link} (Dashboard → Payments). We need your name, address, date of birth and tax number — or, for a business, its registration details.': { de: 'Das dauert etwa zwei Minuten: {link} (Dashboard → Zahlungen). Wir brauchen deinen Namen, deine Adresse, dein Geburtsdatum und deine Steuernummer — oder, für ein Unternehmen, dessen Registerdaten.', es: 'Son unos dos minutos: {link} (Panel → Pagos). Necesitamos tu nombre, dirección, fecha de nacimiento y número fiscal o, si eres empresa, sus datos de registro.', fr: 'Ça prend environ deux minutes : {link} (Tableau de bord → Paiements). Il nous faut ton nom, ton adresse, ta date de naissance et ton numéro fiscal — ou, pour une entreprise, ses données d\'immatriculation.' },
  'This is our last reminder. If we still don\'t have your details 60 days after our first request, the law may require us to hold your payouts until you add them.': { de: 'Das ist unsere letzte Erinnerung. Wenn wir deine Daten 60 Tage nach unserer ersten Anfrage noch nicht haben, kann das Gesetz uns verpflichten, deine Auszahlungen zurückzuhalten, bis du sie ergänzt.', es: 'Es nuestro último recordatorio. Si 60 días después de nuestra primera solicitud aún no tenemos tus datos, la ley puede obligarnos a retener tus pagos hasta que los añadas.', fr: 'C\'est notre dernier rappel. Si nous n\'avons toujours pas tes informations 60 jours après notre première demande, la loi peut nous obliger à bloquer tes versements jusqu\'à ce que tu les ajoutes.' },
  'Your details are private: only you and the CapturaGo team can see them, and they are used only for tax reporting.': { de: 'Deine Daten sind privat: Nur du und das CapturaGo-Team könnt sie sehen, und sie werden nur für die Steuermeldung verwendet.', es: 'Tus datos son privados: solo tú y el equipo de CapturaGo podéis verlos, y solo se usan para la declaración fiscal.', fr: 'Tes informations sont privées : seuls toi et l\'équipe CapturaGo pouvez les voir, et elles servent uniquement à la déclaration fiscale.' },
  'Your CapturaGo earnings statement for {year} (DAC7)': { de: 'Deine CapturaGo-Einnahmenübersicht für {year} (DAC7)', es: 'Tu resumen de ingresos de CapturaGo de {year} (DAC7)', fr: 'Ton relevé de revenus CapturaGo pour {year} (DAC7)' },
  'none (place of birth: {place})': { de: 'keine (Geburtsort: {place})', es: 'ninguno (lugar de nacimiento: {place})', fr: 'aucun (lieu de naissance : {place})' },
  'As required by EU law (the DAC7 directive), CapturaGo reports the earnings of creators who live in the EU to the Slovak tax authority (Finančná správa), which shares them with the tax authority of your country. This is what we report for {year}:': { de: 'Wie vom EU-Recht (DAC7-Richtlinie) vorgeschrieben, meldet CapturaGo die Einnahmen von Creatorn mit Wohnsitz in der EU an die slowakische Steuerbehörde (Finančná správa), die sie an die Steuerbehörde deines Landes weitergibt. Das melden wir für {year}:', es: 'Como exige la ley de la UE (directiva DAC7), CapturaGo comunica los ingresos de los creadores que viven en la UE a la autoridad tributaria eslovaca (Finančná správa), que los comparte con la autoridad tributaria de tu país. Esto es lo que comunicamos de {year}:', fr: 'Comme l\'exige le droit européen (directive DAC7), CapturaGo déclare les revenus des créateurs qui vivent dans l\'UE à l\'administration fiscale slovaque (Finančná správa), qui les transmet à celle de ton pays. Voici ce que nous déclarons pour {year} :' },
  'Here is the summary of your earnings on CapturaGo in {year}. You live outside the EU, so it isn\'t reported to an EU tax authority — keep it for your own tax return:': { de: 'Hier ist die Übersicht deiner Einnahmen auf CapturaGo im Jahr {year}. Du wohnst außerhalb der EU, daher wird sie keiner EU-Steuerbehörde gemeldet — bewahre sie für deine eigene Steuererklärung auf:', es: 'Este es el resumen de tus ingresos en CapturaGo en {year}. Vives fuera de la UE, así que no se comunica a ninguna autoridad tributaria de la UE; guárdalo para tu propia declaración:', fr: 'Voici le récapitulatif de tes revenus sur CapturaGo en {year}. Tu vis hors de l\'UE, il n\'est donc pas déclaré à une administration fiscale européenne — garde-le pour ta propre déclaration :' },
  'Name': { de: 'Name', es: 'Nombre', fr: 'Nom' },
  'Address': { de: 'Adresse', es: 'Dirección', fr: 'Adresse' },
  'Tax number': { de: 'Steuernummer', es: 'Número fiscal', fr: 'Numéro fiscal' },
  'VAT number': { de: 'USt-IdNr.', es: 'Número de IVA', fr: 'Numéro de TVA' },
  'Registration number': { de: 'Registernummer', es: 'Número de registro', fr: 'Numéro d\'immatriculation' },
  'Quarter': { de: 'Quartal', es: 'Trimestre', fr: 'Trimestre' },
  'Paid to you': { de: 'An dich ausgezahlt', es: 'Pagado a ti', fr: 'Versé à toi' },
  'Jobs': { de: 'Aufträge', es: 'Trabajos', fr: 'Missions' },
  'Our fees': { de: 'Unsere Gebühren', es: 'Nuestras comisiones', fr: 'Nos frais' },
  'Total': { de: 'Gesamt', es: 'Total', fr: 'Total' },
  '“Paid to you” is the price of the shoots that were paid out to you in that quarter, before our fees; tips and payments outside CapturaGo aren\'t included.': { de: '„An dich ausgezahlt“ ist der Preis der Shootings, die dir in diesem Quartal ausgezahlt wurden, vor unseren Gebühren; Trinkgelder und Zahlungen außerhalb von CapturaGo sind nicht enthalten.', es: '«Pagado a ti» es el precio de las sesiones que se te pagaron en ese trimestre, antes de nuestras comisiones; no incluye propinas ni pagos fuera de CapturaGo.', fr: '« Versé à toi » est le prix des shootings qui t\'ont été versés ce trimestre-là, avant nos frais ; les pourboires et paiements hors CapturaGo ne sont pas inclus.' },
  'If anything is wrong, correct it in {link} and reply to this email so we can update the report.': { de: 'Wenn etwas nicht stimmt, korrigiere es in {link} und antworte auf diese E-Mail, damit wir die Meldung aktualisieren können.', es: 'Si algo está mal, corrígelo en {link} y responde a este correo para que podamos actualizar la declaración.', fr: 'Si quelque chose est faux, corrige-le dans {link} et réponds à cet e-mail pour que nous mettions à jour la déclaration.' },
  'your tax details': { de: 'deinen Steuerdaten', es: 'tus datos fiscales', fr: 'tes informations fiscales' },
};

// ── CapturaGo server helpers (inlined into every function by build.py) ──
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Only allow https links (files, deliveries) — never javascript: or http:
function cleanHttpsUrl(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (v.length > 500) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' ? u.href : null;
  } catch { return null; }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Stripe expects nested form encoding: a[b][0][c]=1
function formEncode(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === 'object') formEncode(item, `${key}[${i}]`, out);
        else out.append(`${key}[${i}]`, String(item));
      });
    } else if (typeof v === 'object') {
      formEncode(v, key, out);
    } else {
      out.append(key, String(v));
    }
  }
  return out;
}

function makeCtx(deps) {
  const env = (k, d) => {
    const v = deps.env(k);
    return v === undefined || v === null || v === '' ? d : v;
  };
  const nowMs = () => (deps.now ? deps.now() : Date.now());
  const SUPABASE_URL = String(env('SUPABASE_URL', '')).replace(/\/$/, '');
  const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY', '');

  async function db(path, { method = 'GET', body, prefer = 'return=representation' } = {}) {
    const r = await deps.fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: prefer,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!r.ok) {
      const msg = (data && data.message) || text || `status ${r.status}`;
      const err = new Error(`Database error: ${msg}`);
      err.code = data && data.code;
      throw err;
    }
    return data;
  }

  async function getUser(req) {
    const auth = req.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) throw new HttpError(401, 'Please sign in first.');
    const r = await deps.fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: auth, apikey: env('SUPABASE_ANON_KEY', SERVICE_KEY) },
    });
    if (!r.ok) throw new HttpError(401, 'Your session expired. Please sign in again.');
    const u = await r.json();
    if (!u || !u.id || !u.email) throw new HttpError(401, 'Your session expired. Please sign in again.');
    return u;
  }

  async function stripe(path, params, { method = 'POST', idempotencyKey } = {}) {
    const key = env('STRIPE_SECRET_KEY', '');
    if (!key) throw new HttpError(503, 'Online payments are not set up yet.');
    const headers = { Authorization: `Bearer ${key}` };
    let body;
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = formEncode(params || {}).toString();
    }
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const r = await deps.fetch(`https://api.stripe.com/v1/${path}`, { method, headers, body });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || `Stripe error ${r.status}`;
      console.error('[stripe]', path, msg);
      throw new HttpError(502, `Payment provider error: ${msg}`);
    }
    return data;
  }

  // Whole days between today (UTC) and an ISO date (YYYY-MM-DD)
  function daysUntil(isoDate) {
    const today = new Date(nowMs()).toISOString().slice(0, 10);
    return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  }

  // ISO date (YYYY-MM-DD) n days from today (UTC)
  function isoInDays(n) {
    return new Date(nowMs() + n * 86400000).toISOString().slice(0, 10);
  }

  function pct(name, def) {
    const n = Number(env(name, def));
    return Number.isFinite(n) && n >= 0 && n <= 30 ? n : def;
  }

  return {
    env, db, getUser, stripe, daysUntil, isoInDays, pct, nowMs,
    siteUrl: String(env('SITE_URL', 'https://capturago.com')).replace(/\/$/, ''),
  };
}

async function readJson(req) {
  try { return (await req.json()) || {}; }
  catch { throw new HttpError(400, 'Invalid request.'); }
}

function wrap(fn) {
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error('[unhandled]', e);
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
  };
}

async function sendEmail(ctx, deps, to, subject, html) {
  const key = ctx.env('RESEND_API_KEY', '');
  if (!key || !to) return false;
  try {
    const r = await deps.fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: ctx.env('EMAIL_FROM', 'CapturaGo <noreply@capturago.com>'), to, subject, html }),
    });
    return r.ok;
  } catch (e) {
    console.error('[email]', e);
    return false;
  }
}

/* ── App push notifications through Expo's push service (https://exp.host). The app registers its token with
   register_push_token(); the server only ever sends to a user's own tokens. Optional secret: EXPO_ACCESS_TOKEN
   (if "enhanced push security" is on in the Expo project). PUSH_DISABLED=1 turns pushes off. Never throws. */
const PUSH_TOKEN_RE = /^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,200}\]$/;
/** Email HTML → a short plain line for a notification (tags removed, entities decoded, cut at max). */
function plainText(html, max = 178) {
  const t = String(html || '').replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}
async function sendPush(ctx, deps, userId, title, body, data = {}) {
  if (!userId || !UUID_RE.test(String(userId)) || ctx.env('PUSH_DISABLED', '') === '1') return 0;
  try {
    const rows = await ctx.db(`push_tokens?user_id=eq.${userId}&select=token&order=last_seen_at.desc&limit=10`);
    const tokens = (rows || []).map((r) => r.token).filter((t) => PUSH_TOKEN_RE.test(t));
    if (!tokens.length) return 0;
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const key = ctx.env('EXPO_ACCESS_TOKEN', '');
    if (key) headers.Authorization = `Bearer ${key}`;
    // The title is an email subject (plain text already); the body is email HTML
    const head = String(title || '').replace(/\s+/g, ' ').trim();
    const msgs = tokens.map((to) => ({ to, title: head.length > 100 ? `${head.slice(0, 99).trimEnd()}…` : head, body: plainText(body), data, sound: 'default', channelId: 'default', priority: 'high' }));
    const r = await deps.fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers, body: JSON.stringify(msgs) });
    if (!r.ok) { console.error('[push] status', r.status); return 0; }
    const out = await r.json().catch(() => ({}));
    const tickets = Array.isArray(out && out.data) ? out.data : [];
    // Uninstalled apps / revoked permission: forget those tokens
    const dead = tokens.filter((_, i) => tickets[i] && tickets[i].status === 'error' && tickets[i].details && tickets[i].details.error === 'DeviceNotRegistered');
    if (dead.length) {
      await ctx.db(`push_tokens?token=in.(${encodeURIComponent(dead.map((t) => `"${t}"`).join(','))})`, { method: 'DELETE', prefer: 'return=minimal' }).catch((e) => console.error('[push] cleanup', e));
    }
    return tickets.filter((t) => t && t.status === 'ok').length;
  } catch (e) {
    console.error('[push]', e);
    return 0;
  }
}

/* ── Text messages (SMS / WhatsApp) through Twilio — keys only in Supabase secrets ──
   SMS: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (or TWILIO_MESSAGING_SERVICE_SID).
   WhatsApp (optional): TWILIO_WHATSAPP_FROM and an approved template TWILIO_WHATSAPP_TEMPLATE_SID
   (optional per language: TWILIO_WHATSAPP_TEMPLATE_SID_DE / _ES / _FR). Without WhatsApp, texts go by SMS. */
const PHONE_RE = /^\+[1-9][0-9]{6,14}$/;
/** "+421 900 123 456", "00421900123456" → "+421900123456"; anything else → '' */
function normPhone(raw) {
  let s = String(raw || '').trim().replace(/[\s().\-\/]/g, '');
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  return PHONE_RE.test(s) ? s : '';
}
function maskPhone(p) { const s = String(p || ''); return s.length > 6 ? `${s.slice(0, 4)} ••• ${s.slice(-3)}` : s; }
function textsConfigured(ctx) {
  return !!(ctx.env('TWILIO_ACCOUNT_SID', '') && ctx.env('TWILIO_AUTH_TOKEN', '') && (ctx.env('TWILIO_FROM', '') || ctx.env('TWILIO_MESSAGING_SERVICE_SID', '')));
}
/** Sends one text. WhatsApp only with an approved template (wa = its variables); otherwise SMS. true = accepted by Twilio. */
async function sendText(ctx, deps, to, channel, body, wa, lang) {
  const sid = ctx.env('TWILIO_ACCOUNT_SID', ''), tok = ctx.env('TWILIO_AUTH_TOKEN', '');
  if (!sid || !tok || !PHONE_RE.test(String(to || ''))) return false;
  const params = new URLSearchParams();
  const waFrom = ctx.env('TWILIO_WHATSAPP_FROM', '');
  const waTpl = ctx.env(`TWILIO_WHATSAPP_TEMPLATE_SID_${String(lang || '').toUpperCase()}`, '') || ctx.env('TWILIO_WHATSAPP_TEMPLATE_SID', '');
  if (channel === 'whatsapp' && wa && waFrom && waTpl) {
    params.set('To', `whatsapp:${to}`);
    params.set('From', `whatsapp:${waFrom.replace(/^whatsapp:/, '')}`);
    params.set('ContentSid', waTpl);
    params.set('ContentVariables', JSON.stringify(wa));
  } else {
    const ms = ctx.env('TWILIO_MESSAGING_SERVICE_SID', ''), from = ctx.env('TWILIO_FROM', '');
    if (!ms && !from) return false;
    params.set('To', to);
    if (ms) params.set('MessagingServiceSid', ms); else params.set('From', from);
    params.set('Body', String(body).slice(0, 600));
  }
  try {
    const r = await deps.fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${sid}:${tok}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!r.ok) console.error('[text]', r.status, (await r.text().catch(() => '')).slice(0, 200));
    return r.ok;
  } catch (e) {
    console.error('[text]', e);
    return false;
  }
}

/* ── Weather-aware reminders: heavy rain on a shoot day (Open-Meteo, free, no key) ──
   Heavy = a heavy-rain / violent-shower / thunderstorm forecast, or lots of rain that is very likely.
   Light drizzle or a "40 % chance" is not heavy — many shoots go ahead in that. */
const HEAVY_RAIN_CODES = [65, 67, 82, 95, 96, 99];   // heavy rain, heavy freezing rain, violent showers, thunderstorms
function isHeavyRain(code, pct, mm) {
  const c = Number(code), p = Number(pct), m = Number(mm);
  if (HEAVY_RAIN_CODES.includes(c)) return true;
  if ((c === 63 || c === 81) && Number.isFinite(p) && p >= 70) return true;   // moderate rain / showers, very likely
  return Number.isFinite(m) && m >= 10 && Number.isFinite(p) && p >= 60;      // 10 mm+ of rain, likely
}
/** { heavy, pct, mm } for a place and day (0–15 days ahead), or null when unknown. Cached per run; never throws. */
async function rainForecast(ctx, deps, coords, isoDate) {
  const lat = Number(coords && coords.lat), lon = Number(coords && coords.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || !/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ''))) return null;
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${isoDate}`;
  if (!ctx._wx) ctx._wx = new Map();
  if (ctx._wx.has(key)) return ctx._wx.get(key);
  let out = null;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&daily=weather_code,precipitation_probability_max,precipitation_sum&timezone=auto&start_date=${isoDate}&end_date=${isoDate}`;
    const r = await Promise.race([deps.fetch(url), new Promise((_, no) => setTimeout(() => no(new Error('weather timeout')), 6000))]);
    if (r && r.ok) {
      const d = ((await r.json()) || {}).daily || {};
      const code = Number(d.weather_code && d.weather_code[0]);
      const pct = Number(d.precipitation_probability_max && d.precipitation_probability_max[0]);
      const mm = Number(d.precipitation_sum && d.precipitation_sum[0]);
      if (Number.isFinite(code)) out = { heavy: isHeavyRain(code, pct, mm), pct: Number.isFinite(pct) ? Math.round(pct) : null, mm: Number.isFinite(mm) ? Math.round(mm) : null };
    }
  } catch (e) { console.error('[weather]', e && e.message ? e.message : e); }
  ctx._wx.set(key, out);
  return out;
}

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** The package as the traveller saw it when paying — kept with the booking (fair for problems and refunds). */
function packageSnapshot(pkg) {
  const num = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined; };
  const out = {
    name: String(pkg.name || 'Shoot').slice(0, 60),
    price_eur: Number(pkg.price_eur),
    type: pkg.type === 'delivery' ? 'delivery' : 'session',
    minutes: num(pkg.minutes, 1, 1440),
    photos: num(pkg.photos, 1, 2000),
    edit_days: pkg.type === 'delivery' ? undefined : num(pkg.edit_days, 1, 60),
    delivery_days: pkg.type === 'delivery' ? num(pkg.delivery_days, 1, 30) : undefined,
    revisions: pkg.type === 'delivery' ? num(pkg.revisions, 0, 5) : undefined,
    includes: (Array.isArray(pkg.includes) ? pkg.includes : []).filter((x) => typeof x === 'string' && x.trim()).slice(0, 6).map((x) => x.trim().slice(0, 60)),
    desc: pkg.desc ? String(pkg.desc).slice(0, 200) : undefined,
  };
  if (!out.includes.length) delete out.includes;
  return JSON.parse(JSON.stringify(out));   // drops the undefined fields
}

/** "Mexico City, Mexico" → "mexico-city" — the city page at /in/<slug> */
function citySlug(city) {
  return String(city || '').split(',')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function euro(cents) {
  return `€${(cents / 100).toFixed(2)}`;
}

function startServer(createHandler) {
  if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
    Deno.serve(createHandler({ env: (k) => Deno.env.get(k), fetch: (...a) => fetch(...a) }));
  }
}

// ── Shared booking money movements (used by booking-action, scheduled-jobs and admin) ──
// Idempotency keys make retries and races safe: Stripe executes each at most once.
/** Gives all the money of a booking back: the card payment (or every friend's share of a split booking)
 *  and the gift card part (back onto the card it came from). Returns a refund id for the record (or 'gift'). */
async function refundBooking(ctx, b) {
  let refundId = null;
  if (Number(b.split_count) > 1) {
    const shares = await ctx.db(`booking_shares?booking_id=eq.${b.id}&status=eq.paid&select=id,stripe_payment_intent_id`);
    for (const s of shares || []) {
      if (!s.stripe_payment_intent_id) continue;
      const r = await ctx.stripe('refunds', { payment_intent: s.stripe_payment_intent_id, metadata: { booking_id: b.id, share_id: s.id } }, { idempotencyKey: `refund-share-${s.id}` });
      await ctx.db(`booking_shares?id=eq.${s.id}&status=eq.paid`, { method: 'PATCH', body: { status: 'refunded', stripe_refund_id: r.id }, prefer: 'return=minimal' });
      refundId = refundId || r.id;
    }
  } else if (b.stripe_payment_intent_id) {
    const r = await ctx.stripe('refunds', { payment_intent: b.stripe_payment_intent_id, metadata: { booking_id: b.id } }, { idempotencyKey: `refund-${b.id}` });
    refundId = r.id;
  }
  const gift = Number(await ctx.db('rpc/release_gift', { method: 'POST', body: { p_booking: b.id } })) || 0;
  if (!refundId && !gift && Number(b.split_count) <= 1) throw new HttpError(409, 'Payment not found for this booking.');
  return refundId || (gift ? 'gift' : null);
}
/** Pays the creator. Paid by one card: from that payment. Paid partly by gift card or by several friends:
 *  from CapturaGo's Stripe balance (the money of those payments). */
async function releaseBooking(ctx, b) {
  const pooled = Number(b.gift_cents) > 0 || Number(b.split_count) > 1;
  if (!b.creator_stripe_account_id || (!pooled && !b.stripe_payment_intent_id)) throw new HttpError(409, 'Payout details missing for this booking.');
  let charge = null;
  if (!pooled) {
    const pi = await ctx.stripe(`payment_intents/${b.stripe_payment_intent_id}`, null, { method: 'GET' });
    charge = typeof pi.latest_charge === 'string' ? pi.latest_charge : (pi.latest_charge && pi.latest_charge.id);
    if (!charge) throw new HttpError(409, 'Payment not settled yet.');
  }
  const t = await ctx.stripe('transfers', {
    amount: b.price_cents - b.creator_fee_cents,
    currency: b.currency || 'eur',
    destination: b.creator_stripe_account_id,
    ...(charge ? { source_transaction: charge } : {}),
    transfer_group: b.id,
    metadata: { booking_id: b.id },
  }, { idempotencyKey: `transfer-${b.id}` });
  return t.id;
}
/** Bookings that keep a creator's day (same rule as the database's booking_holds_day) — a PostgREST filter. */
function dayHoldFilter(ctx) {
  const since = encodeURIComponent(new Date(ctx.nowMs() - 30 * 60000).toISOString());
  const now = encodeURIComponent(new Date(ctx.nowMs()).toISOString());
  return `or=(status.in.(paid,confirmed),and(status.eq.pending_payment,created_at.gt.${since}),and(status.eq.pending_payment,split_deadline.gt.${now}))`;
}
/** "€132.00" or "€132.00 (€50.00 from a gift card)" */
function paidText(b, lang) {
  return Number(b.gift_cents) > 0 ? L(lang, '{amount} ({gift} from a gift card)', { amount: euro(b.total_cents), gift: euro(b.gift_cents) }) : euro(b.total_cents);
}

/** "€132.00" or "€82.00 to your card and €50.00 back on your gift card" */
function refundText(b, lang) {
  const g = Number(b.gift_cents) || 0;
  return g > 0 ? L(lang, '{card} to your card and {gift} back on your gift card', { card: euro(b.total_cents - g), gift: euro(g) }) : euro(b.total_cents);
}

/* ── Emails in the reader's language (English, German, Spanish, French) ──
   The language is the one the person chose on the website or in the app (email_prefs.lang); people
   without an account (a friend paying a share, a gift card's recipient) get the language of the person
   who booked or bought. Texts: MAIL_TEXT in mail-i18n.js — the English sentence is the key. */
const MAIL_LANGS = ['en', 'de', 'es', 'fr'];
function L(lang, en, vars) {
  const row = MAIL_TEXT[en];
  const s = (lang && lang !== 'en' && row && row[lang]) || en;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m)) : s;
}
/** The language for emails to an account (by its id, or else by its email address). Never fails: 'en'. */
async function mailLang(ctx, userId, email) {
  const uid = UUID_RE.test(String(userId || '')) ? String(userId) : null;
  const em = email ? String(email).trim().toLowerCase().slice(0, 254) : null;
  if (!uid && !em) return 'en';
  const key = `${uid || ''}|${em || ''}`;
  if (!ctx._mailLangs) ctx._mailLangs = new Map();
  if (ctx._mailLangs.has(key)) return ctx._mailLangs.get(key);
  let lang = 'en';
  try {
    const r = await ctx.db('rpc/email_lang', { method: 'POST', body: { p_user: uid, p_email: em } });
    if (MAIL_LANGS.includes(r)) lang = r;
  } catch { /* not set up yet → English */ }
  ctx._mailLangs.set(key, lang);
  return lang;
}
/** "Hi Ana," as its own paragraph */
const hiP = (lang, name) => `<p>${name ? L(lang, 'Hi {name},', { name }) : L(lang, 'Hi there,')}</p>`;

/** After a booking is fully paid (card, gift card, or the last friend's share): instant booking + emails. */
async function afterBookingPaid(ctx, deps, booking) {
  let b = booking;
  if (b.offer_id) {   // a creator's offer on a shoot request was booked → the request is done, other offers are declined
    try {
      const [acc] = await ctx.db(`request_offers?id=eq.${b.offer_id}&status=eq.open`, { method: 'PATCH', body: { status: 'accepted', updated_at: new Date(ctx.nowMs()).toISOString() } });
      const rid = acc && acc.request_id;
      if (rid) {
        await ctx.db(`shoot_requests?id=eq.${rid}&status=eq.open`, { method: 'PATCH', body: { status: 'booked' }, prefer: 'return=minimal' });
        await ctx.db(`request_offers?request_id=eq.${rid}&status=eq.open`, { method: 'PATCH', body: { status: 'declined', updated_at: new Date(ctx.nowMs()).toISOString() }, prefer: 'return=minimal' });
      }
    } catch (e) { console.error('[offer] could not close the request', e); }
  }
  const [creator] = await ctx.db(`photographers?id=eq.${b.photographer_id}&select=user_id,email,name,instant_book,max_per_day`);
  const remote = b.booking_type === 'delivery';
  // Instant booking: confirmed right away if the day still has room (otherwise the creator decides as usual)
  let instant = false;
  if (!remote && creator && creator.instant_book) {
    const others = await ctx.db(`bookings?photographer_id=eq.${b.photographer_id}&shoot_date=eq.${b.shoot_date}&booking_type=eq.session&status=in.(paid,confirmed)&id=neq.${b.id}&select=id&limit=10`);
    if ((others || []).length < Math.min(Math.max(Number(creator.max_per_day) || 1, 1), 6)) {
      const moved = await ctx.db(`bookings?id=eq.${b.id}&status=eq.paid`, { method: 'PATCH', body: { status: 'confirmed' } });
      if (moved && moved[0]) { b = moved[0]; instant = true; }
    }
  }
  const whenText = (lang) => {
    const when = escHtml(b.shoot_date) + (b.time_slot ? ` (${escHtml(L(lang, slotLabel(b.time_slot)))})` : '');
    if (remote) return L(lang, 'due by {date}', { date: `<strong>${when}</strong>` });
    return b.shoot_city ? L(lang, 'on {date} in {city}', { date: `<strong>${when}</strong>`, city: `<strong>${escHtml(String(b.shoot_city).split(',')[0])}</strong>` }) : L(lang, 'on {date}', { date: `<strong>${when}</strong>` });
  };
  const releaseText = (lang) => (remote ? L(lang, 'when the client approves your delivery') : payoutHold(b).promised ? L(lang, '{n} days after you send the photos', { n: RELEASE_DAYS }) : L(lang, 'after the shoot'));
  const pkg = `<strong>${escHtml(b.package_name)}</strong>`;
  // to the creator
  const lc = await mailLang(ctx, creator && creator.user_id, creator && creator.email);
  const viaLink = (b.via_link ? `<p>${L(lc, '✨ Booked through your personal CapturaGo link.')}</p>` : '')
    + (Number(b.split_count) > 1 ? `<p>${L(lc, '👥 {n} friends shared the cost.', { n: Number(b.split_count) })}</p>` : '')
    + (Number(b.deal_pct) > 0 ? `<p>${L(lc, '⚡ Booked at your last-minute price (−{n}%).', { n: Number(b.deal_pct) })}</p>` : '')
    + (b.surprise ? `<p>${L(lc, '🤫 <strong>It\'s a surprise</strong> (for example a proposal) — the other person doesn\'t know. Please don\'t contact or tag them before the moment; plan everything with the traveller in your CapturaGo messages.')}</p>` : '');
  const bookingsLink = (lang, text) => `<a href="${ctx.siteUrl}/dashboard.html#bookings">${L(lang, text)}</a>`;
  await sendEmail(ctx, deps, creator && creator.email,
    instant ? L(lc, 'Confirmed booking: {pkg} on {date}', { pkg: b.package_name, date: b.shoot_date }) : remote ? L(lc, 'New order: {pkg} (due {date})', { pkg: b.package_name, date: b.shoot_date }) : L(lc, 'New booking: {pkg} on {date}', { pkg: b.package_name, date: b.shoot_date }),
    hiP(lc, escHtml(creator && creator.name)) + `<p>${L(lc, '{client} booked {pkg} {when} and paid {amount}.', { client: `<strong>${escHtml(b.client_name)}</strong>`, pkg, when: whenText(lc), amount: euro(b.total_cents) })}</p>` + viaLink +
    (b.note ? `<p>${L(lc, 'Their note: “{note}”', { note: escHtml(b.note) })}</p>` : '') +
    (b.client_files_url ? `<p>${L(lc, 'Their files: {link}', { link: `<a href="${escHtml(b.client_files_url)}">${escHtml(b.client_files_url)}</a>` })}</p>` : '') +
    (instant
      ? `<p>${L(lc, '⚡ It\'s <strong>confirmed automatically</strong> because you use instant booking. {open} to message {first}. The payment is released to you {release}.', { open: bookingsLink(lc, 'Open your bookings'), first: escHtml(String(b.client_name).split(' ')[0]), release: releaseText(lc) })}</p>`
      : `<p>${L(lc, 'Please {action}. The payment is held safely and released to you {release}.', { action: bookingsLink(lc, remote ? 'accept the order in your dashboard' : 'confirm the booking in your dashboard'), release: releaseText(lc) })}</p>`));
  await sendPush(ctx, deps, creator && creator.user_id,
    instant ? L(lc, 'Confirmed booking: {pkg} on {date}', { pkg: b.package_name, date: b.shoot_date }) : remote ? L(lc, 'New order: {pkg} (due {date})', { pkg: b.package_name, date: b.shoot_date }) : L(lc, 'New booking: {pkg} on {date}', { pkg: b.package_name, date: b.shoot_date }),
    L(lc, '{client} booked {pkg} {when} and paid {amount}.', { client: escHtml(b.client_name), pkg: escHtml(b.package_name), when: whenText(lc), amount: euro(b.total_cents) }),
    { url: '/bookings', booking_id: b.id });
  // to the traveller
  const lt = await mailLang(ctx, b.client_user_id, b.client_email);
  const heldUntil = remote ? L(lt, 'you approve the delivery') : payoutHold(b).promised ? L(lt, 'your photos arrive') : L(lt, 'your shoot is done');
  const split = Number(b.split_count) > 1;
  const payLine = split
    ? (instant ? 'Everyone has paid their share — {amount} in total for {pkg} {when} is received and held safely by CapturaGo until {until}.' : 'Everyone has paid their share — {amount} in total for {pkg} {when} is confirmed and held safely by CapturaGo until {until}.')
    : (instant ? 'Your payment of {amount} for {pkg} {when} is received and held safely by CapturaGo until {until}.' : 'Your payment of {amount} for {pkg} {when} is confirmed and held safely by CapturaGo until {until}.');
  await sendEmail(ctx, deps, b.client_email, clientSubject(b, instant ? L(lt, 'Confirmed — {pkg} on {date}', { pkg: b.package_name, date: b.shoot_date }) : L(lt, 'Booking received — {pkg}', { pkg: b.package_name }), lt),
    hiP(lt, escHtml(b.client_name)) + `<p>${L(lt, payLine, { amount: split ? euro(b.total_cents) : paidText(b, lt), pkg, when: whenText(lt), until: heldUntil })}</p>` +
    (instant ? `<p>${L(lt, '⚡ <strong>Your shoot is confirmed.</strong> Message your creator in {link} to plan the details.', { link: `<a href="${ctx.siteUrl}/dashboard.html#messages">CapturaGo</a>` })}</p>`
      : `<p>${L(lt, 'The creator will confirm shortly. Track it in {link}.', { link: bookingsLink(lt, 'your bookings') })}</p>`));
  return { booking: b, instant };
}

// ── Gift card codes: CG-XXXX-XXXX-XXXX-XXXX (80 random bits; no 0/O or 1/I/L) ──
const GIFT_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newGiftCode() {
  const chars = [];
  while (chars.length < 16) {                     // rejection sampling: every symbol equally likely
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    for (const x of bytes) if (x < 248 && chars.length < 16) chars.push(GIFT_ALPHABET[x % 31]);   // 31 symbols: no 0/O, 1/I/L
  }
  return `CG-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}-${chars.slice(12, 16).join('')}`;
}
/** Email address of an account (service role → Supabase Auth admin API); '' if unknown. */
async function accountEmail(ctx, deps, userId) {
  if (!UUID_RE.test(String(userId || ''))) return '';
  const base = String(ctx.env('SUPABASE_URL', '')).replace(/\/$/, '');
  const key = ctx.env('SUPABASE_SERVICE_ROLE_KEY', '');
  try {
    const r = await deps.fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) return '';
    const u = await r.json();
    return String((u && u.email) || '');
  } catch { return ''; }
}
// Conditional status change: only succeeds if the booking is still in `from`
async function moveBooking(ctx, id, from, to, extra = {}) {
  const rows = await ctx.db(`bookings?id=eq.${id}&status=eq.${from}`, { method: 'PATCH', body: { status: to, ...extra } });
  return rows && rows[0] ? rows[0] : null;
}
async function isAdmin(ctx, userId) {
  if (!UUID_RE.test(String(userId || ''))) return false;
  const rows = await ctx.db(`admins?user_id=eq.${userId}&select=user_id`);
  return Array.isArray(rows) && rows.length === 1;
}
function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function creatorContact(ctx, b) {
  if (!b.photographer_id) return null;
  const [c] = await ctx.db(`photographers?id=eq.${b.photographer_id}&select=user_id,email,name`);
  if (!c) return null;
  c.lang = await mailLang(ctx, c.user_id, c.email);
  return c;
}

// ── Time of day for in-person sessions (same list as the website and app) ──
const TIME_SLOTS = { sunrise: 'Sunrise', morning: 'Morning', midday: 'Midday', afternoon: 'Afternoon', golden_hour: 'Golden hour', evening: 'Evening', flexible: 'Flexible time' };
const slotLabel = (s) => TIME_SLOTS[s] || '';

// ── Photo delivery storage (private bucket "deliveries", files at <booking id>/<file>) ──
async function deleteDeliveryFiles(ctx, deps, paths) {
  // Each photo has a small preview next to it: <booking>/t_<file>
  const valid = (paths || []).filter((p) => typeof p === 'string' && /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,80}$/.test(p));
  const list = [...new Set(valid.flatMap((p) => { const [dir, file] = p.split('/'); return file.startsWith('t_') ? [p] : [p, `${dir}/t_${file}`]; }))];
  if (!list.length) return 0;
  const base = String(ctx.env('SUPABASE_URL', '')).replace(/\/$/, '');
  const key = ctx.env('SUPABASE_SERVICE_ROLE_KEY', '');
  for (let i = 0; i < list.length; i += 500) {
    const r = await deps.fetch(`${base}/storage/v1/object/deliveries`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: list.slice(i, i + 500) }),
    });
    if (!r.ok) throw new Error(`Could not delete delivered photos (${r.status}).`);
  }
  return valid.length;
}
/** Deletes all delivered photos (files + records) of the given bookings. */
async function purgeBookingPhotos(ctx, deps, bookingIds) {
  const ids = (bookingIds || []).filter((id) => UUID_RE.test(String(id)));
  if (!ids.length) return 0;
  const rows = await ctx.db(`booking_photos?booking_id=in.(${ids.join(',')})&select=path&limit=5000`);
  const n = await deleteDeliveryFiles(ctx, deps, (rows || []).map((r) => r.path));
  await ctx.db(`booking_photos?booking_id=in.(${ids.join(',')})`, { method: 'DELETE', prefer: 'return=minimal' });
  return n;
}

// ── Surprise mode: email subjects to the traveller don't give the plan away
//    (a partner may see notifications on a shared phone or laptop) ──
function clientSubject(b, subject, lang) {
  return b && b.surprise ? L(lang, 'An update from CapturaGo') : subject;
}

// ── Shoot plan helpers ──
const MEETING_TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
function mapsLink(place) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(place || '').slice(0, 300))}`;
}
/** HTML block with the meeting point/time (and the surprise reminder) for emails. */
function planHtml(b, forCreator, lang) {
  const parts = [];
  if (b.shoot_city && b.booking_type !== 'delivery') parts.push(L(lang, '🌍 City: {city} (the creator\'s trip)', { city: escHtml(String(b.shoot_city).split(',')[0]) }));
  if (b.meeting_point) parts.push(L(lang, '📍 Meeting point: {place}', { place: `<a href="${escHtml(mapsLink(b.meeting_point))}">${escHtml(b.meeting_point)}</a>` }));
  if (b.meeting_time) parts.push(L(lang, '🕒 Time: {time}', { time: escHtml(b.meeting_time) }));
  else if (b.time_slot) parts.push(`🕒 ${escHtml(L(lang, slotLabel(b.time_slot)))}`);
  if (forCreator && b.surprise) parts.push(L(lang, '🤫 <strong>Surprise:</strong> the other person doesn\'t know — don\'t contact or tag them before the moment.'));
  if (forCreator && Array.isArray(b.shot_list) && b.shot_list.length) parts.push(L(lang, '📝 Shot list: {list}', { list: b.shot_list.map(escHtml).join(' · ') }));
  return parts.length ? `<p>${parts.join('<br/>')}</p>` : '';
}

// ── Signed (temporary) links to private delivered photos ──
async function signDeliveryUrls(ctx, deps, paths, seconds = 3600) {
  const list = (paths || []).filter((p) => typeof p === 'string' && /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,80}$/.test(p));
  if (!list.length) return {};
  const base = String(ctx.env('SUPABASE_URL', '')).replace(/\/$/, '');
  const key = ctx.env('SUPABASE_SERVICE_ROLE_KEY', '');
  const out = {};
  for (let i = 0; i < list.length; i += 200) {
    const r = await deps.fetch(`${base}/storage/v1/object/sign/deliveries`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: seconds, paths: list.slice(i, i + 200) }),
    });
    if (!r.ok) throw new Error(`Could not prepare the photos (${r.status}).`);
    for (const x of (await r.json()) || []) {
      if (x && x.path && x.signedURL && !x.error) out[x.path] = `${base}/storage/v1${x.signedURL.startsWith('/') ? '' : '/'}${x.signedURL}`;
    }
  }
  return out;
}

// ── Payment held until the photos arrive (packages that promise photos "within N days") ──
const RELEASE_DAYS = 3;
/** { promised, delivered, dueIso, releaseAt (ms, or null while waiting for the photos) } for an in-person booking. */
function payoutHold(b) {
  const days = Math.round(Number(b && b.package_details && b.package_details.edit_days));
  const promised = !!b && b.booking_type !== 'delivery' && days >= 1 && days <= 60;
  const shootMs = b && b.shoot_date ? Date.parse(`${b.shoot_date}T00:00:00Z`) : NaN;
  const afterShoot = shootMs + RELEASE_DAYS * 86400000;
  if (!promised) return { promised: false, delivered: false, dueIso: '', releaseAt: afterShoot };
  const dueIso = new Date(shootMs + days * 86400000).toISOString().slice(0, 10);
  const deliveredMs = b.photos_delivered_at ? Date.parse(b.photos_delivered_at) : NaN;
  if (!Number.isFinite(deliveredMs)) return { promised: true, delivered: false, dueIso, releaseAt: null };
  return { promised: true, delivered: true, dueIso, releaseAt: Math.max(afterShoot, deliveredMs + RELEASE_DAYS * 86400000) };
}

// ── Creators on the road: where a creator is on a given day ──
/** Same rule as the database's city_key(): first part before the comma, lower case, single spaces. */
function cityKey(c) {
  return String(c || '').split(',')[0].trim().toLowerCase().replace(/\s+/g, ' ');
}
/** The trip covering an ISO date, or null when the creator is at home. */
function tripOn(trips, iso) {
  return (Array.isArray(trips) ? trips : []).find((t) => t && typeof t.from === 'string' && typeof t.to === 'string' && iso >= t.from && iso <= t.to) || null;
}

// ── Calendar sync: read busy days from a creator's own calendar (iCal link) ──
// Only these providers are fetched — the server never visits any other address (same list as the database).
const CALENDAR_HOST_RE = /^(calendar\.google\.com|([a-z0-9-]+\.)*icloud\.com|outlook\.live\.com|outlook\.office365\.com|outlook\.office\.com|calendar\.proton\.me|user\.fm)$/i;
function calendarUrlOk(raw) {
  const s = String(raw || '');
  if (s.length < 20 || s.length > 1000 || /[\s<>"\\]/.test(s)) return false;
  let u;
  try { u = new URL(s); } catch { return false; }
  return u.protocol === 'https:' && !u.username && !u.password && !u.port && CALENDAR_HOST_RE.test(u.hostname) && s.toLowerCase().startsWith(`https://${u.hostname.toLowerCase()}/`);
}
const CAL_MAX_BYTES = 3 * 1024 * 1024;
class CalendarError extends Error {}
async function fetchCalendar(deps, url) {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    if (!calendarUrlOk(current)) throw new CalendarError(hop ? 'Your calendar link redirects somewhere we can\'t read.' : 'This calendar link isn\'t supported.');
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ac ? setTimeout(() => ac.abort(), 10000) : null;
    let r;
    try { r = await deps.fetch(current, { redirect: 'manual', headers: { Accept: 'text/calendar, text/plain;q=0.8' }, ...(ac ? { signal: ac.signal } : {}) }); }
    catch { throw new CalendarError('Your calendar didn\'t answer. We\'ll try again later.'); }
    finally { if (timer) clearTimeout(timer); }
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get('location');
      if (!loc) throw new CalendarError('Your calendar link doesn\'t work any more. Copy it again from your calendar app.');
      try { current = new URL(loc, current).href; } catch { throw new CalendarError('Your calendar link doesn\'t work any more.'); }
      continue;
    }
    if (!r.ok) throw new CalendarError(`Your calendar link doesn't work any more (error ${r.status}). Copy it again from your calendar app.`);
    const len = Number(r.headers.get('content-length'));
    if (Number.isFinite(len) && len > CAL_MAX_BYTES) throw new CalendarError('Your calendar is too big to read (over 3 MB).');
    const buf = await r.arrayBuffer();
    if (buf.byteLength > CAL_MAX_BYTES) throw new CalendarError('Your calendar is too big to read (over 3 MB).');
    const text = new TextDecoder().decode(buf);
    if (!/BEGIN:VCALENDAR/i.test(text.slice(0, 2000))) throw new CalendarError('This link isn\'t a calendar. Use the secret iCal link (it ends in .ics).');
    return text;
  }
  throw new CalendarError('Your calendar link redirects too many times.');
}

/** Days (YYYY-MM-DD, between fromIso and toIso) blocked by the calendar: all-day events, and events of 3 hours or more.
 *  Events marked "free" or cancelled don't count. Repeats: daily, weekly (with days), monthly and yearly. */
function parseIcsBusy(text, fromIso, toIso, maxDays = 400) {
  const lines = String(text || '').replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const busy = new Set();
  const fromMs = Date.parse(`${fromIso}T00:00:00Z`), toMs = Date.parse(`${toIso}T00:00:00Z`) + 86400000;
  const DAY = 86400000, MIN_TIMED = 3 * 3600000;
  const parseDt = (params, v) => {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(v || '').trim());
    if (!m) return null;
    const allDay = !m[4] || /VALUE=DATE(;|$)/i.test(params);
    const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], allDay ? 0 : +m[4], allDay ? 0 : +m[5], allDay ? 0 : +(m[6] || 0));
    return Number.isFinite(ms) ? { ms, allDay } : null;
  };
  const parseDur = (v) => {
    const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(v || '').trim());
    if (!m || m[1] === '-') return null;
    return ((+(m[2] || 0) * 7 + +(m[3] || 0)) * 24 * 3600 + +(m[4] || 0) * 3600 + +(m[5] || 0) * 60 + +(m[6] || 0)) * 1000;
  };
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const addBusy = (startMs, durMs, allDay) => {
    if (allDay) {
      const end = startMs + Math.max(durMs, DAY);
      for (let d = startMs; d < end && busy.size < maxDays * 4; d += DAY) if (d >= fromMs && d < toMs) busy.add(iso(d));
    } else if (durMs >= MIN_TIMED) {
      const first = Date.parse(`${iso(startMs)}T00:00:00Z`), last = startMs + durMs - 1;
      for (let d = first; d <= last && busy.size < maxDays * 4; d += DAY) if (d >= fromMs && d < toMs) busy.add(iso(d));
    }
  };
  const WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  function occurrences(start, rule, exdates) {
    const out = [];
    const p = {};
    for (const part of String(rule || '').split(';')) { const [k, v] = part.split('='); if (k && v) p[k.toUpperCase()] = v.toUpperCase(); }
    const freq = p.FREQ;
    const interval = Math.min(Math.max(parseInt(p.INTERVAL || '1', 10) || 1, 1), 1000);
    const count = p.COUNT ? Math.min(Math.max(parseInt(p.COUNT, 10) || 0, 0), 5000) : Infinity;
    const untilDt = p.UNTIL ? parseDt('', p.UNTIL) : null;
    const until = untilDt ? (untilDt.allDay ? untilDt.ms + DAY - 1 : untilDt.ms) : Infinity;
    const unsupported = Object.keys(p).some((k) => !['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'WKST'].includes(k))
      || (p.BYDAY && freq !== 'WEEKLY') || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq);
    if (unsupported) return [start];             // only the first date we can be sure of
    const days = p.BYDAY ? p.BYDAY.split(',').map((d) => WD[d.replace(/^[+-]?\d+/, '')]).filter((d) => d !== undefined) : [];
    const d0 = new Date(start);
    const timeOfDay = start - Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate());
    let n = 0;
    const push = (ms) => { if (ms > until || n >= count) return false; n++; if (!exdates.has(iso(ms))) out.push(ms); return true; };
    // Open-ended repeats that began long ago: jump close to the window (a COUNT has to be counted from the start)
    let k0 = 0;
    if (count === Infinity && fromMs > start) {
      const f = new Date(fromMs);
      const steps = freq === 'DAILY' ? (fromMs - start) / (interval * DAY)
        : freq === 'WEEKLY' ? (fromMs - start) / (interval * 7 * DAY)
        : freq === 'MONTHLY' ? ((f.getUTCFullYear() - d0.getUTCFullYear()) * 12 + f.getUTCMonth() - d0.getUTCMonth()) / interval
        : (f.getUTCFullYear() - d0.getUTCFullYear()) / interval;
      k0 = Math.max(0, Math.floor(steps) - 1);
    }
    for (let k = k0; k < k0 + 5000 && n < count; k++) {
      let batch;
      if (freq === 'DAILY') batch = [start + k * interval * DAY];
      else if (freq === 'WEEKLY') {
        if (!days.length) batch = [start + k * interval * 7 * DAY];
        else {
          const monday = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate() - ((d0.getUTCDay() + 6) % 7)) + k * interval * 7 * DAY;
          batch = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((wd) => monday + ((wd + 6) % 7) * DAY + timeOfDay).filter((ms) => ms >= start);
        }
      } else if (freq === 'MONTHLY') {
        const y = d0.getUTCFullYear(), m = d0.getUTCMonth() + k * interval, dd = d0.getUTCDate();
        const ms = Date.UTC(y, m, dd) + timeOfDay;
        batch = new Date(ms).getUTCDate() === dd ? [ms] : [];        // months without that day are skipped
      } else {
        const y = d0.getUTCFullYear() + k * interval;
        const ms = Date.UTC(y, d0.getUTCMonth(), d0.getUTCDate()) + timeOfDay;
        batch = new Date(ms).getUTCMonth() === d0.getUTCMonth() ? [ms] : [];
      }
      let stop = false;
      for (const ms of batch) { if (ms >= toMs || !push(ms)) { stop = true; break; } }
      if (stop) break;
    }
    return out;
  }
  let ev = null, depth = 0, events = 0;
  for (const line of lines) {
    const u = line.toUpperCase();
    if (u.startsWith('BEGIN:VEVENT')) { ev = { ex: new Set() }; depth = 0; continue; }
    if (!ev) continue;
    if (u.startsWith('BEGIN:')) { depth++; continue; }               // VALARM etc.
    if (u.startsWith('END:') && depth > 0) { depth--; continue; }
    if (depth > 0) continue;
    if (u.startsWith('END:VEVENT')) {
      if (++events > 20000) break;
      if (ev.start && !ev.free && !ev.cancelled) {
        let dur = ev.end ? ev.end.ms - ev.start.ms : (ev.dur != null ? ev.dur : (ev.start.allDay ? DAY : 0));
        if (!(dur >= 0)) dur = 0;
        const starts = ev.rrule ? occurrences(ev.start.ms, ev.rrule, ev.ex) : [ev.start.ms];
        for (const s of starts) if (s < toMs && s + Math.max(dur, 1) > fromMs) addBusy(s, dur, ev.start.allDay);
      }
      ev = null; continue;
    }
    const i = line.indexOf(':');
    if (i < 1) continue;
    const head = line.slice(0, i), value = line.slice(i + 1);
    const [name, ...rest] = head.split(';');
    const params = rest.join(';');
    switch (name.toUpperCase()) {
      case 'DTSTART': ev.start = parseDt(params, value); break;
      case 'DTEND': ev.end = parseDt(params, value); break;
      case 'DURATION': ev.dur = parseDur(value); break;
      case 'RRULE': ev.rrule = value; break;
      case 'EXDATE': for (const v of value.split(',')) { const d = parseDt(params, v); if (d) ev.ex.add(iso(d.ms)); } break;
      case 'TRANSP': ev.free = value.trim().toUpperCase() === 'TRANSPARENT'; break;
      case 'STATUS': ev.cancelled = value.trim().toUpperCase() === 'CANCELLED'; break;
      default: break;
    }
  }
  return [...busy].sort().slice(0, maxDays);
}

/** Reads one creator's calendar and stores the busy days (keeps the old ones if the calendar can't be read). */
async function syncCalendarImport(ctx, deps, row) {
  const nowIso = new Date(ctx.nowMs()).toISOString();
  const enc = encodeURIComponent(row.url);
  try {
    const text = await fetchCalendar(deps, row.url);
    const dates = parseIcsBusy(text, ctx.isoInDays(0), ctx.isoInDays(365));
    const done = await ctx.db(`calendar_imports?user_id=eq.${row.user_id}&url=eq.${enc}`, { method: 'PATCH', body: { last_synced_at: nowIso, last_error: null, busy_count: dates.length } });
    if (!done || !done.length) return { skipped: true };           // the link was changed or removed meanwhile
    await ctx.db(`photographers?user_id=eq.${row.user_id}`, { method: 'PATCH', body: { external_busy_dates: dates }, prefer: 'return=minimal' });
    return { busy_count: dates.length, last_synced_at: nowIso, last_error: null };
  } catch (e) {
    const msg = e instanceof CalendarError ? e.message : 'We couldn\'t read your calendar. We\'ll try again later.';
    if (!(e instanceof CalendarError)) console.error('[calendar]', row.user_id, e);
    await ctx.db(`calendar_imports?user_id=eq.${row.user_id}&url=eq.${enc}`, { method: 'PATCH', body: { last_synced_at: nowIso, last_error: msg.slice(0, 200) }, prefer: 'return=minimal' }).catch(() => {});
    return { error: msg, last_synced_at: nowIso, last_error: msg };
  }
}

// ── Calendar feed: your CapturaGo bookings as an .ics file for Google / Apple / Outlook ──
function icsText(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
/** Lines longer than 75 bytes are folded (RFC 5545), never splitting a character. */
function icsFold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = []; let cur = '', size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; size = 0; }
    cur += ch; size += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}
function buildIcsFeed(bookings, userId, siteUrl, nowMs) {
  const ymd = (iso) => String(iso).replace(/-/g, '');
  const next = (iso) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const stamp = new Date(nowMs).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const first = (n) => String(n || '').trim().split(/\s+/)[0] || '';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CapturaGo//Bookings//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:CapturaGo bookings', 'X-PUBLISHED-TTL:PT1H', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H'];
  for (const b of bookings || []) {
    if (!b || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.shoot_date || ''))) continue;
    const asCreator = b.creator_user_id === userId;
    const remote = b.booking_type === 'delivery';
    const creator = first(b.photographers && b.photographers.name) || 'your creator';
    const client = first(b.client_name) || 'your client';
    const time = b.meeting_time || slotLabel(b.time_slot);
    let summary;
    if (!asCreator && b.surprise) summary = 'CapturaGo booking';         // calendars are often shared — keep the surprise
    else if (remote) summary = asCreator ? `🎬 Due: ${b.package_name} for ${client}` : `🎬 ${b.package_name} from ${creator} (due)`;
    else summary = (asCreator ? `📸 ${b.package_name} with ${client}` : `📸 ${b.package_name} with ${creator}`) + (time ? ` · ${time}` : '');
    const place = remote ? '' : (b.meeting_point || b.shoot_city || (b.photographers && b.photographers.city) || '');
    const desc = [
      !remote && time ? `Time: ${time}` : '',
      !remote && b.meeting_point ? `Meeting point: ${b.meeting_point}` : '',
      asCreator && b.surprise ? 'Surprise — the other person doesn\'t know.' : '',
      b.status === 'paid' ? 'Waiting for the creator to confirm.' : '',
      `Open in CapturaGo: ${siteUrl}/dashboard.html?b=${b.id}#bookings`,
    ].filter(Boolean).join('\n');
    lines.push('BEGIN:VEVENT', `UID:${b.id}@capturago.com`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(b.shoot_date)}`, `DTEND;VALUE=DATE:${ymd(next(b.shoot_date))}`,
      `SUMMARY:${icsText(summary)}`, ...(place ? [`LOCATION:${icsText(place)}`] : []), `DESCRIPTION:${icsText(desc)}`,
      `URL:${siteUrl}/dashboard.html?b=${b.id}#bookings`, `STATUS:${b.status === 'paid' ? 'TENTATIVE' : 'CONFIRMED'}`, 'TRANSP:OPAQUE', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

// ── create-checkout: traveller books a creator's package ──
// Price is ALWAYS read from the database, never from the browser.
// Money is collected by CapturaGo and only transferred to the creator after the shoot.
function computeFees(priceCents, clientPct, creatorPct) {
  const clientFee = Math.round((priceCents * clientPct) / 100);
  const creatorFee = Math.round((priceCents * creatorPct) / 100);
  return { clientFee, creatorFee, total: priceCents + clientFee, payout: priceCents - creatorFee };
}

function createHandler(deps) {
  const ctx = makeCtx(deps);
  return wrap(async (req) => {
    const user = await ctx.getUser(req);
    const body = await readJson(req);
    let pid = String(body.photographer_id || '');
    const pkgId = String(body.package_id || '');
    let date = String(body.shoot_date || '');
    let note = String(body.note || '').trim().slice(0, 1000);
    // Booking a creator's offer on my shoot request: the price, day and details come from the offer (database)
    let offer = null;
    if (body.offer_id !== undefined && body.offer_id !== null && body.offer_id !== '') {
      const oid = String(body.offer_id);
      if (!UUID_RE.test(oid)) throw new HttpError(404, 'Offer not found.');
      [offer] = await ctx.db(`request_offers?id=eq.${oid}&select=id,photographer_id,price_eur,shoot_date,minutes,photos,edit_days,status,shoot_requests(id,user_id,status,service,people,note)`);
      const q = offer && offer.shoot_requests;
      if (!offer || !q || q.user_id !== user.id) throw new HttpError(404, 'Offer not found.');
      if (offer.status !== 'open' || q.status !== 'open') throw new HttpError(409, 'This offer is no longer open.');
      const used = await ctx.db(`bookings?offer_id=eq.${offer.id}&status=in.(paid,confirmed,delivered,completed,disputed)&select=id&limit=1`);
      if ((used || []).length) throw new HttpError(409, 'This offer is already booked.');
      pid = offer.photographer_id; date = String(offer.shoot_date);
      if (!note && q.note) note = String(q.note).slice(0, 1000);
    }
    const giftCode = String(body.gift_code || '').trim().slice(0, 40);
    const split = body.split === undefined || body.split === null || body.split === '' ? 1 : Math.round(Number(body.split));
    if (!Number.isInteger(split) || split < 1 || split > 6) throw new HttpError(400, 'Split the cost between 2 and 6 people.');
    if (split > 1 && giftCode) throw new HttpError(400, "A gift card can't be combined with splitting the cost.");

    if (!UUID_RE.test(pid)) throw new HttpError(400, 'Creator not found.');
    const filesUrl = cleanHttpsUrl(body.files_url);
    if (filesUrl === null) throw new HttpError(400, 'The link to your files must start with https://');

    const COLS = 'id,user_id,name,packages,payouts_enabled,stripe_account_id,available,hidden,unavailable_dates,max_per_day,instant_book';
    let l;
    try { [l] = await ctx.db(`photographers?id=eq.${pid}&select=${COLS},external_busy_dates,trips`); }
    catch (e) { if (!/external_busy_dates|trips/.test(String(e && e.message))) throw e; [l] = await ctx.db(`photographers?id=eq.${pid}&select=${COLS}`); }   // database update not run yet
    if (!l || l.hidden) throw new HttpError(404, 'Creator not found.');
    if (l.user_id === user.id) throw new HttpError(400, "You can't book your own listing.");
    if (!l.payouts_enabled || !l.stripe_account_id) throw new HttpError(400, "This creator doesn't take online bookings yet. Send them an inquiry instead.");
    if (l.available === false) throw new HttpError(400, 'This creator is not available right now.');

    const pkg = offer
      ? { id: `offer-${offer.id.slice(0, 8)}`, name: 'Your custom offer', type: 'session', price_eur: offer.price_eur, minutes: offer.minutes,
          ...(offer.photos !== null ? { photos: offer.photos } : {}), ...(offer.edit_days !== null ? { edit_days: offer.edit_days } : {}) }
      : (Array.isArray(l.packages) ? l.packages : []).find((p) => p && String(p.id) === pkgId);
    if (!pkg) throw new HttpError(400, 'This package no longer exists. Please refresh.');
    const price = Number(pkg.price_eur);
    if (!Number.isFinite(price) || price < 10 || price > (offer ? 10000 : 5000)) throw new HttpError(400, 'This package has an invalid price.');

    // Session = meet on a date. Delivery = remote work, due date set by the package.
    const isDelivery = pkg.type === 'delivery';
    let shootDate = date;
    let revisions = 0;
    let timeSlot = null;
    if (isDelivery) {
      const turnaround = Math.round(Number(pkg.delivery_days));
      if (!Number.isFinite(turnaround) || turnaround < 1 || turnaround > 30) throw new HttpError(400, 'This package has an invalid delivery time.');
      revisions = Math.min(Math.max(Math.round(Number(pkg.revisions)) || 0, 0), 5);
      shootDate = ctx.isoInDays(turnaround);
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new HttpError(400, 'Choose a date for your shoot.');
      const days = ctx.daysUntil(date);
      if (days < 1) throw new HttpError(400, 'Choose a date from tomorrow onwards.');
      if (days > 365) throw new HttpError(400, 'You can book up to one year ahead.');
      // Availability: the creator's days off, and days already fully booked
      if ([...(Array.isArray(l.unavailable_dates) ? l.unavailable_dates : []), ...(Array.isArray(l.external_busy_dates) ? l.external_busy_dates : [])].includes(date)) throw new HttpError(409, `${String(l.name).split(' ')[0]} isn't available on that day. Please choose another date.`);
      const taken = await ctx.db(`bookings?photographer_id=eq.${l.id}&shoot_date=eq.${date}&booking_type=eq.session&${dayHoldFilter(ctx)}&select=id&limit=10`);
      if ((taken || []).length >= Math.min(Math.max(Number(l.max_per_day) || 1, 1), 6)) throw new HttpError(409, 'That day was just booked. Please choose another date.');
      const slot = String(body.time_slot || '');
      if (slot && !TIME_SLOTS[slot]) throw new HttpError(400, 'Choose a time of day.');
      timeSlot = slot || null;
    }

    // Split between friends: in-person shoots only, at least 3 days ahead; everyone pays within 48 hours (and a day before the shoot)
    let splitDeadline = null;
    if (split > 1) {
      if (isDelivery) throw new HttpError(400, 'Splitting the cost is possible for in-person shoots.');
      if (ctx.daysUntil(shootDate) < 3) throw new HttpError(400, 'To split the cost, choose a shoot date at least 3 days away — your friends need time to pay.');
      // The day is held like any checkout (30 minutes) until the organiser has paid their share;
      // then the friends get up to 48 hours (set when that payment arrives).
      splitDeadline = new Date(ctx.nowMs() + 31 * 60000).toISOString();
    }

    // Last-minute deal: the creator lowered the price for this day (tomorrow or the day after). Read from the
    // database here, never from the browser; not for custom offers or remote work.
    let dealPct = 0;
    if (!offer && !isDelivery && ctx.daysUntil(shootDate) <= 2) {
      try {
        const p = Math.round(Number(await ctx.db('rpc/deal_pct_for', { method: 'POST', body: { p_photographer: l.id, p_day: shootDate } })));
        if (p >= 10 && p <= 50) dealPct = p;
      } catch { dealPct = 0; }   // database update not run yet
    }
    const priceCents = Math.round((price * 100 * (100 - dealPct)) / 100);
    // Booked through the creator's own link (capturago.com/c/<handle>) → lower service fee for their clients
    const viaLink = body.ref === l.id;
    // Sent by a partner (hotel / hostel link or QR card): lower service fee too; the partner gets a thank-you when the shoot is done
    let partner = null;
    const pcode = String(body.partner || '').toUpperCase().trim();
    if (/^[A-Z0-9]{4,12}$/.test(pcode)) {
      try {
        [partner] = await ctx.db(`partners?code=eq.${pcode}&status=eq.approved&select=id,user_id`);
        if (partner && (partner.user_id === user.id || partner.user_id === l.user_id)) partner = null;   // not for your own bookings
      } catch { partner = null; }   // database update not run yet
    }
    const basePct = ctx.pct('CLIENT_FEE_PCT', 10);
    const clientPct = viaLink || partner ? Math.min(ctx.pct(viaLink ? 'CREATOR_LINK_CLIENT_FEE_PCT' : 'PARTNER_CLIENT_FEE_PCT', 5), basePct) : basePct;
    const fees = computeFees(priceCents, clientPct, ctx.pct('CREATOR_FEE_PCT', 0));
    const clientName = String((user.user_metadata && user.user_metadata.full_name) || user.email.split('@')[0]).slice(0, 80);

    const bookingRow = {
      photographer_id: l.id,
      creator_user_id: l.user_id,
      creator_stripe_account_id: l.stripe_account_id,
      client_user_id: user.id,
      client_name: clientName,
      client_email: user.email,
      package_id: String(pkg.id),
      package_name: String(pkg.name || 'Shoot').slice(0, 60),
      package_minutes: Number.isFinite(Number(pkg.minutes)) ? Number(pkg.minutes) : null,
      package_details: packageSnapshot(pkg),
      shoot_date: shootDate,
      note: note || null,
      booking_type: isDelivery ? 'delivery' : 'session',
      client_files_url: filesUrl || null,
      revisions_allowed: revisions,
      time_slot: timeSlot,
      via_link: viaLink,
      surprise: !isDelivery && body.surprise === true,
      ...(offer ? { offer_id: offer.id } : {}),
      ...(partner ? { partner_id: partner.id } : {}),
      ...(dealPct ? { deal_pct: dealPct } : {}),
      currency: 'eur',
      ...(split > 1 ? { split_count: split, split_deadline: splitDeadline } : {}),
      price_cents: priceCents,
      client_fee_cents: fees.clientFee,
      creator_fee_cents: fees.creatorFee,
      total_cents: fees.total,
    };
    let booking;
    try { [booking] = await ctx.db('bookings', { method: 'POST', body: bookingRow }); }
    catch (e) {
      if (!/package_details|deal_pct/.test(String(e && e.message))) throw e;
      if (/deal_pct/.test(String(e && e.message))) throw new HttpError(409, 'Last-minute prices need the latest database update. Please try again later.');
      const { package_details: _d, ...rest } = bookingRow;   // database update not run yet
      [booking] = await ctx.db('bookings', { method: 'POST', body: rest });
    }
    const giveUp = async () => {   // the booking can't go ahead: free the day and any gift money
      await ctx.db(`bookings?id=eq.${booking.id}&status=eq.pending_payment`, { method: 'PATCH', body: { status: 'expired' }, prefer: 'return=minimal' }).catch(() => {});
      await ctx.db('rpc/release_gift', { method: 'POST', body: { p_booking: booking.id } }).catch(() => {});
    };
    const productName = `${String(pkg.name || 'Shoot').slice(0, 60)} with ${String(l.name).slice(0, 60)}`;
    const okUrl = body.from === 'app' ? `${ctx.siteUrl}/app-return.html?to=booking&s=ok` : `${ctx.siteUrl}/booking.html?b=${booking.id}&s=ok`;
    const cancelUrl = body.from === 'app' ? `${ctx.siteUrl}/app-return.html?to=booking&s=cancel` : `${ctx.siteUrl}/booking.html?b=${booking.id}&s=cancel`;
    const expiresAt = Math.floor(ctx.nowMs() / 1000) + 31 * 60;   // the day is held for 30 minutes while paying

    // ── Split: the organiser pays share 1 now; the friends get their own links ──
    if (split > 1) {
      const each = Math.floor(fees.total / split);
      const shareRows = Array.from({ length: split }, (_, i) => ({ booking_id: booking.id, share_no: i + 1, amount_cents: i === 0 ? fees.total - each * (split - 1) : each }));
      if (each < 50) { await giveUp(); throw new HttpError(400, 'This package is too small to split.'); }
      let shares;
      try { shares = await ctx.db('booking_shares', { method: 'POST', body: shareRows }); }
      catch (e) { await giveUp(); throw e; }
      const mine = shares.find((x) => x.share_no === 1);
      let session;
      try {
        session = await ctx.stripe('checkout/sessions', {
          mode: 'payment', customer_email: user.email, client_reference_id: booking.id, expires_at: expiresAt,
          line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: mine.amount_cents, product_data: { name: `Your share (1 of ${split}): ${productName}`,
            description: `Shoot date: ${shootDate}${booking.shoot_city ? ` · in ${String(booking.shoot_city).split(',')[0].slice(0, 60)}` : ''} · held safely until ${payoutHold(booking).promised ? 'your photos arrive' : 'your shoot is done'}; refunded if not everyone pays in time` } } }],
          payment_intent_data: { transfer_group: booking.id, metadata: { booking_id: booking.id, share_id: mine.id } },
          metadata: { kind: 'share', booking_id: booking.id, share_id: mine.id, payer: user.id },
          success_url: okUrl, cancel_url: cancelUrl,
        }, { idempotencyKey: `checkout-share-${mine.id}` });
      } catch (e) { await giveUp(); throw e; }
      await ctx.db(`booking_shares?id=eq.${mine.id}`, { method: 'PATCH', body: { stripe_checkout_session_id: session.id }, prefer: 'return=minimal' });
      return json({ url: session.url, booking_id: booking.id, split, share_cents: mine.amount_cents });
    }

    // ── Gift card: take what's needed from it (the database checks and locks the card) ──
    if (giftCode) {
      const check = await ctx.db('rpc/gift_check_as', { method: 'POST', body: { p_user: user.id, p_code: giftCode } });
      if (!check || !check.ok) { await giveUp(); throw new HttpError(400, (check && check.error) || 'We couldn\'t find that gift card. Please check the code.'); }
      let used;
      try { used = Number(await ctx.db('rpc/reserve_gift', { method: 'POST', body: { p_code: giftCode, p_booking: booking.id, p_total: fees.total } })); }
      catch (e) { await giveUp(); throw new HttpError(400, String((e && e.message) || '').replace(/^Database error: /, '') || 'This gift card can\'t be used right now.'); }
      booking.gift_cents = used;
      if (used >= fees.total) {   // fully paid by the gift card — no card payment needed
        const done = await ctx.db(`bookings?id=eq.${booking.id}&status=eq.pending_payment`, { method: 'PATCH', body: { status: 'paid', paid_at: new Date(ctx.nowMs()).toISOString() } });
        if (!done || !done[0]) { await giveUp(); throw new HttpError(409, 'This booking was just updated. Please try again.'); }
        await afterBookingPaid(ctx, deps, done[0]);
        return json({ url: okUrl, booking_id: booking.id, paid: true, gift_cents: used });
      }
      let session;
      try {
        session = await ctx.stripe('checkout/sessions', {
          mode: 'payment', customer_email: user.email, client_reference_id: booking.id, expires_at: expiresAt,
          line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: fees.total - used, product_data: { name: productName,
            description: `Package ${euro(priceCents)}${dealPct ? ` (last-minute −${dealPct}%)` : ''}${fees.clientFee ? ` + service fee ${euro(fees.clientFee)}` : ''} − gift card ${euro(used)}${isDelivery ? '' : ` · shoot date ${shootDate}`}` } } }],
          payment_intent_data: { transfer_group: booking.id, metadata: { booking_id: booking.id } },
          metadata: { kind: 'booking', booking_id: booking.id },
          success_url: okUrl, cancel_url: cancelUrl,
        }, { idempotencyKey: `checkout-${booking.id}` });
      } catch (e) { await giveUp(); throw e; }
      await ctx.db(`bookings?id=eq.${booking.id}`, { method: 'PATCH', body: { stripe_checkout_session_id: session.id }, prefer: 'return=minimal' });
      return json({ url: session.url, booking_id: booking.id, gift_cents: used });
    }

    const lineItems = [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: priceCents,
        product_data: { name: `${String(pkg.name || 'Shoot').slice(0, 60)} with ${String(l.name).slice(0, 60)}`, description: isDelivery ? `Delivered by ${shootDate}${revisions ? ` · ${revisions} revision${revisions > 1 ? 's' : ''}` : ''}` : `Shoot date: ${shootDate}${timeSlot ? ` · ${slotLabel(timeSlot)}` : ''}${booking.shoot_city ? ` · in ${String(booking.shoot_city).split(',')[0].slice(0, 60)}` : ''}${dealPct ? ` · last-minute price (−${dealPct}%)` : ''}${l.instant_book ? ' · confirmed instantly' : ''}` },
      },
    }];
    if (fees.clientFee > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: fees.clientFee,
          product_data: { name: 'CapturaGo service fee', description: isDelivery ? 'Secure payment, held until you approve the delivery' : payoutHold(booking.package_details ? booking : bookingRow).promised ? 'Secure payment, held until your photos arrive' : 'Secure payment, held until your shoot is done' },
        },
      });
    }

    let session;
    try {
      session = await ctx.stripe('checkout/sessions', {
        mode: 'payment',
        customer_email: user.email,
        client_reference_id: booking.id,
        expires_at: expiresAt,
        line_items: lineItems,
        payment_intent_data: { transfer_group: booking.id, metadata: { booking_id: booking.id } },
        metadata: { kind: 'booking', booking_id: booking.id },
        // From the app: a simple "done, close this window" page instead of the website booking page
        success_url: okUrl,
        cancel_url: cancelUrl,
      }, { idempotencyKey: `checkout-${booking.id}` });
    } catch (e) {
      await giveUp();
      throw e;
    }

    await ctx.db(`bookings?id=eq.${booking.id}`, { method: 'PATCH', body: { stripe_checkout_session_id: session.id }, prefer: 'return=minimal' });
    return json({ url: session.url, booking_id: booking.id, ...(dealPct ? { deal_pct: dealPct } : {}) });
  });
}

startServer(createHandler);

export { createHandler };
