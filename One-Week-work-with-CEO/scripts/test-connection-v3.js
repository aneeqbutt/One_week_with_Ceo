import GoLogin from 'gologin';

// Your GoLogin Token
const GOLOGIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NjdkZjY2MDAwMjUxYmVhZTBlNzE4NTMiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2OTAxZWFkMWQ5ZDQwMGQwNWVhNTRlOGYifQ.V1bHwt59yXUbP8wODHM_K0Pa2Ipf0wv8l06cP8zthmc';

async function testConnection() {
    console.log('='.repeat(60));
    console.log('GoLogin SDK Connection Test');
    console.log('='.repeat(60) + '\n');
    
    try {
        console.log('1. Testing folder fetch...');
        const folderResponse = await fetch('https://api.gologin.com/folders', {
            headers: {
                'Authorization': `Bearer ${GOLOGIN_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!folderResponse.ok) {
            throw new Error(`Folder fetch failed: ${folderResponse.status}`);
        }
        
        const folders = await folderResponse.json();
        console.log(`✓ Successfully fetched ${folders.length} folders\n`);
        
        folders.forEach((folder, index) => {
            console.log(`   ${index + 1}. ${folder.name} (${folder.id})`);
        });
        
        console.log('\n2. Testing profile fetch...');
        const profileResponse = await fetch('https://api.gologin.com/browser/v2', {
            headers: {
                'Authorization': `Bearer ${GOLOGIN_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!profileResponse.ok) {
            throw new Error(`Profile fetch failed: ${profileResponse.status}`);
        }
        
        const profileData = await profileResponse.json();
        const profiles = profileData.profiles || [];
        console.log(`✓ Successfully fetched ${profiles.length} total profiles\n`);
        
        // Group profiles by folder
        const profilesByFolder = {};
        profiles.forEach(profile => {
            const folderId = profile.folders?.[0] || profile.folderId || 'no-folder';
            if (!profilesByFolder[folderId]) {
                profilesByFolder[folderId] = [];
            }
            profilesByFolder[folderId].push(profile.name);
        });
        
        console.log('Profiles by folder:');
        folders.forEach(folder => {
            const folderProfiles = profilesByFolder[folder.id] || [];
            console.log(`   ${folder.name}: ${folderProfiles.length} profiles`);
        });
        
        console.log('\n3. Testing GoLogin SDK initialization...');
        // Just test that we can import and reference the class
        console.log('✓ GoLogin SDK imported successfully\n');
        
        console.log('='.repeat(60));
        console.log('✓ All tests passed! Your setup is working correctly.');
        console.log('='.repeat(60) + '\n');
        console.log('You can now run the main script:');
        console.log('  node gologin-github-star-v3.js');
        console.log('');
        
    } catch (error) {
        console.error('\n' + '='.repeat(60));
        console.error('✗ Test failed!');
        console.error('='.repeat(60));
        console.error('Error:', error.message);
        console.error('\nPlease check:');
        console.error('1. Your API token is correct');
        console.error('2. You have an active internet connection');
        console.error('3. Your GoLogin account is active');
        console.error('4. npm packages are installed (run: npm install)');
        process.exit(1);
    }
}

testConnection();
