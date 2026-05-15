import { promises as fs } from 'fs';

const GOLOGIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NjdkZjY2MDAwMjUxYmVhZTBlNzE4NTMiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2OTAxZWFkMWQ5ZDQwMGQwNWVhNTRlOGYifQ.V1bHwt59yXUbP8wODHM_K0Pa2Ipf0wv8l06cP8zthmc';

async function getFolders() {
    const response = await fetch('https://api.gologin.com/folders', {
        headers: {
            'Authorization': `Bearer ${GOLOGIN_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });
    return await response.json();
}

async function testFolderFilter(folderId, folderName) {
    console.log(`\nTesting folder: ${folderName} (${folderId})`);
    console.log('-'.repeat(60));
    
    const tests = [
        `https://api.gologin.com/browser/v2?folder=${folderId}`,
        `https://api.gologin.com/browser/v2?folderId=${folderId}`,
        `https://api.gologin.com/browser/v2?folder_id=${folderId}`,
        `https://api.gologin.com/browser/v2?folderName=${encodeURIComponent(folderName)}`,
        `https://api.gologin.com/browser/v2?folder=${encodeURIComponent(folderName)}`,
    ];
    
    for (const url of tests) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${GOLOGIN_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const profileCount = data.profiles?.length || 0;
                if (profileCount > 0) {
                    console.log(`✅ ${profileCount} profiles - ${url.split('?')[1]}`);
                    
                    // Show first profile's folder info
                    if (data.profiles[0]) {
                        console.log(`   First profile: ${data.profiles[0].name}`);
                        console.log(`   Folders: ${JSON.stringify(data.profiles[0].folders)}`);
                    }
                }
            }
        } catch (error) {
            // Ignore errors
        }
    }
}

async function main() {
    console.log('='.repeat(70));
    console.log('Testing Folder Filtering in GoLogin API');
    console.log('='.repeat(70));
    
    const folders = await getFolders();
    
    console.log('\nAvailable folders:');
    folders.forEach(f => console.log(`  - ${f.name} (${f.id})`));
    
    // Test day 4 folder specifically
    const day4 = folders.find(f => f.name === 'day 4');
    if (day4) {
        await testFolderFilter(day4.id, day4.name);
    }
    
    // Also test day 1 (we know this has profiles)
    const day1 = folders.find(f => f.name === 'day 1');
    if (day1) {
        await testFolderFilter(day1.id, day1.name);
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('Checking allProfilesCount field');
    console.log('='.repeat(70));
    
    const response = await fetch('https://api.gologin.com/browser/v2', {
        headers: {
            'Authorization': `Bearer ${GOLOGIN_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });
    
    const data = await response.json();
    console.log(`\nAPI returned: ${data.profiles.length} profiles`);
    console.log(`Total profiles (allProfilesCount): ${data.allProfilesCount}`);
    
    if (data.allProfilesCount > data.profiles.length) {
        console.log('\n⚠️  The API knows about more profiles but is only returning 30!');
        console.log('This confirms there\'s a pagination issue.');
    }
}

main();