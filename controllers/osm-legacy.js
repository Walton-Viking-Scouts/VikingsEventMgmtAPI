/**
 * Legacy OSM controller functions
 * 
 * This file contains complex functions that were extracted from the original
 * OSM controller during the refactoring process. These functions have custom
 * business logic that couldn't be easily abstracted into the generic handlers.
 */

/**
 * Helper function to transform member grid data structure
 * 
 * This function transforms the raw OSM API response for member grid data
 * into a more structured format that's easier to work with in the frontend.
 * 
 * @param {Object} rawData - Raw response from OSM API
 * @returns {Object} Transformed data structure
 */
const transformMemberGridData = (rawData) => {
  if (!rawData || !rawData.data || !rawData.meta) {
    return {
      status: false,
      error: 'Invalid data structure from OSM API',
      data: { members: [], metadata: { contact_groups: [] } },
    };
  }
  
  // Build column mapping from metadata
  const columnMapping = {};
  const contactGroups = [];
  
  if (rawData.meta.structure && Array.isArray(rawData.meta.structure)) {
    rawData.meta.structure.forEach(group => {
      if (group.columns && Array.isArray(group.columns)) {
        const groupInfo = {
          group_id: String(group.group_id), // Normalize to string for consistent typing
          name: group.name,
          identifier: group.identifier,
          columns: [],
        };
        
        group.columns.forEach(column => {
          const groupColumnId = `${String(group.group_id)}_${column.column_id}`;
          columnMapping[groupColumnId] = {
            label: column.label,
            type: column.type,
            varname: column.varname,
            group_name: group.name,
          };
          
          groupInfo.columns.push({
            column_id: column.column_id,
            label: column.label,
            type: column.type,
            varname: column.varname,
          });
        });
        
        contactGroups.push(groupInfo);
      }
    });
  }
  
  // Transform member data
  const transformedMembers = [];
  
  Object.entries(rawData.data).forEach(([memberId, memberData]) => {
    const transformedMember = {
      member_id: memberId,
      first_name: memberData.first_name || '',
      last_name: memberData.last_name || '',
      age: memberData.age || '',
      patrol: memberData.patrol || '',
      patrol_id: memberData.patrol_id,
      active: memberData.active,
      joined: memberData.joined,
      started: memberData.started,
      end_date: memberData.end_date,
      date_of_birth: memberData.date_of_birth,
      section_id: memberData.section_id,
      contact_groups: {},
    };
    
    // Transform custom_data using column mapping
    if (memberData.custom_data) {
      Object.entries(memberData.custom_data).forEach(([groupId, groupData]) => {
        const normalizedGroupId = String(groupId); // Normalize groupId to string for consistent comparison
        const groupInfo = contactGroups.find(g => g.group_id === normalizedGroupId);
        const groupName = groupInfo ? groupInfo.name : `Group ${normalizedGroupId}`;
        
        if (!transformedMember.contact_groups[groupName]) {
          transformedMember.contact_groups[groupName] = {};
        }
        
        Object.entries(groupData).forEach(([columnId, value]) => {
          const groupColumnId = `${normalizedGroupId}_${columnId}`;
          const columnInfo = columnMapping[groupColumnId];
          
          if (columnInfo) {
            transformedMember.contact_groups[groupName][columnInfo.label] = value;
          } else {
            // Fallback for unmapped columns
            transformedMember.contact_groups[groupName][`Column ${columnId}`] = value;
          }
        });
      });
    }
    
    transformedMembers.push(transformedMember);
  });
  
  return {
    status: true,
    data: {
      members: transformedMembers,
      metadata: {
        contact_groups: contactGroups,
        column_mapping: columnMapping,
      },
    },
  };
};

module.exports = {
  transformMemberGridData,
};