import React, { useEffect, useState } from 'react';
import { createProjectTeamMembersTable, checkProjectTeamMembersTable } from '@/utils/createProjectTeamTable';

const AutoFixDatabase: React.FC = () => {
  const [isChecking, setIsChecking] = useState(true);
  const [tableExists, setTableExists] = useState(false);

  useEffect(() => {
    const checkAndCreateTable = async () => {
      try {
        setIsChecking(true);
        
        // Check if table exists
        const exists = await checkProjectTeamMembersTable();
        setTableExists(exists);
        
        // If table doesn't exist, try to create it
        if (!exists) {
          console.log('🔧 Attempting to create project_team_members table...');
          const result = await createProjectTeamMembersTable();
          
          if (result.success) {
            setTableExists(true);
            console.log('✅ Database fixed! Team members should now be visible.');
            
            // Refresh the page to reload data
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } else {
            console.log('❌ Could not create table automatically. Please run SQL manually.');
          }
        }
      } catch (error) {
        console.error('Error checking/creating table:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkAndCreateTable();
  }, []);

  // This component doesn't render anything visible
  return null;
};

export default AutoFixDatabase;