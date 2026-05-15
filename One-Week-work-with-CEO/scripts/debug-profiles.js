import { promises as fs } from 'fs';

const GOLOGIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NjdkZjY2MDAwMjUxYmVhZTBlNzE4NTMiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2OTAxZWFkMWQ5ZDQwMGQwNWVhNTRlOGYifQ.V1bHwt59yXUbP8wODHM_K0Pa2Ipf0wv8l06cP8zthmc';

async function debugProfiles() {
    console.log('='.repeat(70));
    console.log('GoLogin Profile Structure Debug Tool');
    console.log('='.repeat(70) + '\n');
    
    try {
        // Fetch folders
        console.log('1. Fetching folders...\n');
        const folderResponse = await fetch('https://api.gologin.com/folders', {
            headers: {
                'Authorization': `Bearer ${GOLOGIN_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        const folders = await folderResponse.json();
        console.log(`Found ${folders.length} folders:\n`);
        folders.forEach((folder, i) => {
            console.log(`${i + 1}. ${folder.name}`);
            console.log(`   ID: ${folder.id}\n`);
        });
        
        // Fetch profiles
        console.log('\n2. Fetching all profiles...\n');
        const profileResponse = await fetch('https://api.gologin.com/browser/v2', {
            headers: {
                'Authorization': `Bearer ${GOLOGIN_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        const profileData = await profileResponse.json();
        const profiles = profileData.profiles || [];
        
        console.log(`Found ${profiles.length} total profiles\n`);
        console.log('='.repeat(70));
        console.log('PROFILE DETAILS (First 3 profiles as sample)');
        console.log('='.repeat(70) + '\n');
        
        // Show first 3 profiles in detail
        profiles.slice(0, 3).forEach((profile, i) => {
            console.log(`Profile ${i + 1}: ${profile.name}`);
            console.log(`  ID: ${profile.id}`);
            console.log(`  folderId: ${profile.folderId || 'NOT SET'}`);
            console.log(`  folders: ${JSON.stringify(profile.folders || 'NOT SET')}`);
            console.log(`  folderIds: ${JSON.stringify(profile.folderIds || 'NOT SET')}`);
            console.log('');
        });
        
        // Analyze folder assignment
        console.log('='.repeat(70));
        console.log('FOLDER ASSIGNMENT ANALYSIS');
        console.log('='.repeat(70) + '\n');
        
        const folderAssignments = {};
        
        profiles.forEach(profile => {
            // Check multiple possible folder fields
            let assignedFolders = [];
            
            if (profile.folderId) assignedFolders.push(profile.folderId);
            if (profile.folders && Array.isArray(profile.folders)) {
                assignedFolders = assignedFolders.concat(profile.folders);
            }
            if (profile.folderIds && Array.isArray(profile.folderIds)) {
                assignedFolders = assignedFolders.concat(profile.folderIds);
            }
            
            // Remove duplicates
            assignedFolders = [...new Set(assignedFolders)];
            
            if (assignedFolders.length === 0) {
                assignedFolders = ['NO_FOLDER'];
            }
            
            assignedFolders.forEach(folderId => {
                if (!folderAssignments[folderId]) {
                    folderAssignments[folderId] = [];
                }
                folderAssignments[folderId].push(profile.name);
            });
        });
        
        // Display folder assignments
        folders.forEach(folder => {
            const profilesInFolder = folderAssignments[folder.id] || [];
            console.log(`📁 ${folder.name} (${folder.id})`);
            console.log(`   Profiles: ${profilesInFolder.length}`);
            if (profilesInFolder.length > 0) {
                profilesInFolder.slice(0, 5).forEach(name => {
                    console.log(`   - ${name}`);
                });
                if (profilesInFolder.length > 5) {
                    console.log(`   ... and ${profilesInFolder.length - 5} more`);
                }
            }
            console.log('');
        });
        
        // Profiles without folder
        const unassigned = folderAssignments['NO_FOLDER'] || [];
        if (unassigned.length > 0) {
            console.log(`📂 Unassigned Profiles: ${unassigned.length}`);
            unassigned.slice(0, 5).forEach(name => {
                console.log(`   - ${name}`);
            });
            if (unassigned.length > 5) {
                console.log(`   ... and ${unassigned.length - 5} more`);
            }
            console.log('');
        }
        
        // Save detailed data to file
        const debugData = {
            folders: folders,
            profiles: profiles.map(p => ({
                name: p.name,
                id: p.id,
                folderId: p.folderId,
                folders: p.folders,
                folderIds: p.folderIds
            })),
            folderAssignments: folderAssignments
        };
        
        await fs.writeFile('debug-profile-structure.json', JSON.stringify(debugData, null, 2));
        
        console.log('='.repeat(70));
        console.log('✓ Debug complete!');
        console.log('='.repeat(70));
        console.log('\nDetailed data saved to: debug-profile-structure.json');
        console.log('\nNext step: Use this information to fix the filtering logic.');
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error);
    }
}

debugProfiles();
