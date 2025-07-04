const admin = require('firebase-admin');
const serviceAccount = require('C:/Users/shawn/OneDrive - Shiobara Family/Documents/CODE/keys/fe-timesheets-29db8-firebase-adminsdk-fbsvc-b21e2d1419.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function printSampleDocs(collection) {
  const snapshot = await db.collection(collection).limit(2).get();
  snapshot.forEach(doc => {
    console.log(`Collection: ${collection}, Doc ID: ${doc.id}`);
    console.log(JSON.stringify(doc.data(), null, 2));
  });
}

async function main() {
  await printSampleDocs('clients');
  await printSampleDocs('locations');
  await printSampleDocs('contacts');
  await printSampleDocs('timeEntries'); // <-- updated
  process.exit();
}

main();