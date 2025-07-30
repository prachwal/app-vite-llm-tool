/**
 * Uproszczony test skript dla Node.js z Blob API
 */

const fs = require('fs');
const crypto = require('crypto');

const AUDIO_FILE_PATH = './src/test/1718848317_Sample_1.mp3';
const API_BASE = 'http://localhost:8000/.netlify/functions/blobs';
const STORE_NAME = 'file-uploads';

async function testUploadDownload() {
    console.log('🎵 Test przesyłania i pobierania pliku audio');
    console.log('='.repeat(50));

    // 1. Oblicz hash oryginalnego pliku
    const originalBuffer = fs.readFileSync(AUDIO_FILE_PATH);
    const originalHash = crypto.createHash('sha256').update(originalBuffer).digest('hex');
    console.log('📁 Plik oryginalny:', AUDIO_FILE_PATH);
    console.log('🔍 Hash oryginalny:', originalHash);
    console.log('📊 Rozmiar:', originalBuffer.length, 'bajtów');

    // 2. Upload za pomocą Blob (zamiast File)
    console.log('\n1️⃣ Przesyłanie pliku...');

    const blob = new Blob([originalBuffer], { type: 'audio/mpeg' });
    const formData = new FormData();
    formData.append('file', blob, '1718848317_Sample_1.mp3');

    try {
        const uploadResponse = await fetch(`${API_BASE}?action=POST&store=${STORE_NAME}`, {
            method: 'POST',
            body: formData
        });

        const uploadResult = await uploadResponse.json();

        if (uploadResponse.ok && uploadResult.status === 201) {
            console.log('✅ Plik przesłany pomyślnie');
            console.log('📄 Klucz:', uploadResult.payload.key);
            console.log('📊 Rozmiar zapisany:', uploadResult.payload.size, 'bajtów');
            console.log('🔧 Base64:', uploadResult.payload.isBase64 ? 'Tak' : 'Nie');
            console.log('📈 Rozmiar oryginalny:', uploadResult.payload.originalSize, 'bajtów');

            // 3. Download
            console.log('\n2️⃣ Pobieranie pliku...');
            const downloadResponse = await fetch(`${API_BASE}?action=GET&key=${uploadResult.payload.key}&store=${STORE_NAME}&raw=true`);

            if (downloadResponse.ok) {
                const downloadedBuffer = Buffer.from(await downloadResponse.arrayBuffer());
                const downloadedHash = crypto.createHash('sha256').update(downloadedBuffer).digest('hex');

                console.log('✅ Plik pobrany pomyślnie');
                console.log('📊 Rozmiar pobrany:', downloadedBuffer.length, 'bajtów');

                // 4. Porównanie
                console.log('\n3️⃣ Porównywanie plików...');
                console.log('🔍 Hash oryginalny:', originalHash);
                console.log('🔍 Hash pobrany:  ', downloadedHash);
                console.log('📏 Rozmiar oryginalny:', originalBuffer.length, 'bajtów');
                console.log('📏 Rozmiar pobrany:   ', downloadedBuffer.length, 'bajtów');

                const isIdentical = originalHash === downloadedHash;

                // 5. Raport końcowy
                console.log('\n' + '='.repeat(50));
                console.log('📋 RAPORT KOŃCOWY');
                console.log('='.repeat(50));
                console.log('🎵 Plik:', AUDIO_FILE_PATH);
                console.log('🔑 Klucz w BLOBS:', uploadResult.payload.key);
                console.log('✅ Transfer prawidłowy:', isIdentical ? 'TAK ✅' : 'NIE ❌');

                if (isIdentical) {
                    console.log('\n🎉 Test zakończony pomyślnie! Wszystkie operacje są prawidłowe.');
                } else {
                    console.log('\n🚨 UWAGA: Transfer nie jest prawidłowy!');
                    process.exit(1);
                }

            } else {
                console.error('❌ Błąd pobierania:', downloadResponse.status, downloadResponse.statusText);
                const errorText = await downloadResponse.text();
                console.error('❌ Treść błędu:', errorText);
                process.exit(1);
            }

        } else {
            console.error('❌ Błąd przesyłania:', uploadResult);
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Błąd testu:', error.message);
        process.exit(1);
    }
}

// Uruchom test
testUploadDownload();
