// Script para verificar dados do usuário no Firestore
const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();
const db = admin.firestore();

async function checkUserData() {
    const email = 'tharcisionardoto@gmail.com';

    console.log('🔍 Buscando usuário:', email);

    // Buscar usuário por email
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();

    if (snapshot.empty) {
        console.log('❌ Usuário não encontrado!');
        return;
    }

    snapshot.forEach(doc => {
        console.log('\n✅ Usuário encontrado!');
        console.log('UID:', doc.id);
        console.log('\nDados:');
        console.log(JSON.stringify(doc.data(), null, 2));
    });
}

checkUserData()
    .then(() => {
        console.log('\n✅ Verificação concluída');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Erro:', error);
        process.exit(1);
    });
