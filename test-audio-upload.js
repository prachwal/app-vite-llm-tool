#!/usr/bin/env node
/**
 * Test skript dla przesyłania i porównywania pliku audio
 * Testuje: upload -> download -> porównanie bajt po bajcie
 */

import fs, { createReadStream } from 'fs';
import crypto from 'crypto';
import fetch from 'node-fetch';
import FormData from 'form-data';

const AUDIO_FILE_PATH = './src/test/1718848317_Sample_1.mp3';
const API_BASE = 'http://localhost:8000/.netlify/functions/blobs';
const STORE_NAME = 'file-uploads';

console.log('🎵 Test przesyłania i porównywania pliku audio');
console.log('='.repeat(50));

// Sprawdź czy plik istnieje
if (!fs.existsSync(AUDIO_FILE_PATH)) {
    console.error('❌ Plik audio nie istnieje:', AUDIO_FILE_PATH);
    process.exit(1);
}

// Oblicz hash oryginalnego pliku
function calculateFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    return { hash, size: fileBuffer.length, buffer: fileBuffer };
}

// Prześlij plik
async function uploadFile() {
    console.log('\n1️⃣ Przesyłanie pliku...');

    const form = new FormData();
    form.append('file', createReadStream(AUDIO_FILE_PATH));

    const response = await fetch(`${API_BASE}?action=POST&store=${STORE_NAME}`, {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
    });

    const result = await response.json();

    if (response.ok && result.status === 201) {
        console.log('✅ Plik przesłany pomyślnie');
        console.log('📄 Klucz:', result.payload.key);
        console.log('📊 Rozmiar zapisany:', result.payload.size, 'bajtów');
        console.log('🔧 Base64:', result.payload.isBase64 ? 'Tak' : 'Nie');
        console.log('📈 Rozmiar oryginalny:', result.payload.originalSize, 'bajtów');
        return result.payload.key;
    } else {
        console.error('❌ Błąd przesyłania:', result);
        throw new Error('Upload failed');
    }
}

// Pobierz plik
async function downloadFile(key) {
    console.log('\n2️⃣ Pobieranie pliku...');

    const response = await fetch(`${API_BASE}?action=GET&key=${key}&store=${STORE_NAME}&raw=true`);

    if (response.ok) {
        const buffer = await response.arrayBuffer();
        console.log('✅ Plik pobrany pomyślnie');
        console.log('📊 Rozmiar pobrany:', buffer.byteLength, 'bajtów');
        return Buffer.from(buffer);
    } else {
        console.error('❌ Błąd pobierania:', response.status, response.statusText);
        throw new Error('Download failed');
    }
}

// Porównaj pliki bajt po bajcie
function compareFiles(original, downloaded) {
    console.log('\n3️⃣ Porównywanie plików...');

    const originalHash = crypto.createHash('sha256').update(original).digest('hex');
    const downloadedHash = crypto.createHash('sha256').update(downloaded).digest('hex');

    console.log('🔍 Hash oryginalny:', originalHash);
    console.log('🔍 Hash pobrany:  ', downloadedHash);
    console.log('📏 Rozmiar oryginalny:', original.length, 'bajtów');
    console.log('📏 Rozmiar pobrany:   ', downloaded.length, 'bajtów');

    if (originalHash === downloadedHash) {
        console.log('✅ Pliki są identyczne! Transfer prawidłowy.');
        return true;
    } else {
        console.log('❌ Pliki różnią się! Transfer nieprawidłowy.');

        // Znajdź pierwsze różnice
        const minLength = Math.min(original.length, downloaded.length);
        for (let i = 0; i < minLength; i++) {
            if (original[i] !== downloaded[i]) {
                console.log(`🔍 Pierwsza różnica na bajcie ${i}:`);
                console.log(`   Oryginalny: 0x${original[i].toString(16).padStart(2, '0')}`);
                console.log(`   Pobrany:    0x${downloaded[i].toString(16).padStart(2, '0')}`);
                break;
            }
        }
        return false;
    }
}

// Główna funkcja testowa
async function runTest() {
    try {
        // Oblicz hash oryginalnego pliku
        const original = calculateFileHash(AUDIO_FILE_PATH);
        console.log('📁 Plik oryginalny:', AUDIO_FILE_PATH);
        console.log('🔍 Hash oryginalny:', original.hash);
        console.log('📊 Rozmiar:', original.size, 'bajtów');

        // Test przesyłania i pobierania
        const key = await uploadFile();
        const downloaded = await downloadFile(key);
        const isIdentical = compareFiles(original.buffer, downloaded);

        // Raport końcowy
        console.log('\n' + '='.repeat(50));
        console.log('📋 RAPORT KOŃCOWY');
        console.log('='.repeat(50));
        console.log('🎵 Plik:', AUDIO_FILE_PATH);
        console.log('🔑 Klucz w BLOBS:', key);
        console.log('✅ Transfer prawidłowy:', isIdentical ? 'TAK' : 'NIE');

        if (!isIdentical) {
            console.log('🚨 UWAGA: Transfer nie jest prawidłowy!');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Błąd testu:', error.message);
        process.exit(1);
    }
}

// Uruchom test
runTest();
