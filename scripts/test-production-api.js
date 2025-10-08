// Test API response to see if answer_choices are being returned

async function testAPI() {
  try {
    const response = await fetch('https://agi-property-inspection-git-fork-ab-5c8f50-aaron-gotts-projects.vercel.app/api/information-sections/sections');
    const data = await response.json();
    
    console.log('📡 API Response received\n');

    if (data.success && data.data && data.data.length > 0) {
      // Find Section 1
      const section1 = data.data.find(s => s.name === '1 - Inspection Details');
      
      if (section1) {
        console.log(`✅ Found Section: ${section1.name}`);
        console.log(`   Checklists: ${section1.checklists?.length || 0} items\n`);
        
        if (section1.checklists && section1.checklists.length > 0) {
          console.log('📋 First 5 checklist items:\n');
          
          section1.checklists.slice(0, 5).forEach((item, idx) => {
            console.log(`${idx + 1}. ${item.text}`);
            console.log(`   - Has answer_choices: ${item.answer_choices ? 'YES' : 'NO'}`);
            if (item.answer_choices) {
              console.log(`   - Count: ${item.answer_choices.length}`);
              console.log(`   - First 3: ${item.answer_choices.slice(0, 3).join(', ')}`);
            }
            console.log('');
          });
        }
      } else {
        console.log('❌ Section 1 - Inspection Details not found');
      }
    } else {
      console.log('❌ No data in API response');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Error calling API:', error);
  }
}

testAPI();
