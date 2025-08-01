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
  
  // Helper function to create safe field names
  const createFieldName = (groupName, columnLabel) => {
    // Input validation - handle null/undefined inputs
    if (!groupName || !columnLabel) {
      console.warn('createFieldName: Invalid input', { groupName, columnLabel });
      return null;
    }
    
    // Convert to string and normalize to lowercase first
    const normalizedGroupName = String(groupName).toLowerCase().trim();
    const normalizedColumnLabel = String(columnLabel).toLowerCase().trim();
    
    // Replace non-alphanumeric characters with underscores
    const safeGroupName = normalizedGroupName.replace(/[^a-z0-9]/g, '_');
    const safeColumnLabel = normalizedColumnLabel.replace(/[^a-z0-9]/g, '_');
    
    // Remove consecutive underscores and trim leading/trailing underscores
    const cleanGroupName = safeGroupName.replace(/_+/g, '_').replace(/^_|_$/g, '');
    const cleanColumnLabel = safeColumnLabel.replace(/_+/g, '_').replace(/^_|_$/g, '');
    
    // Ensure we don't have empty strings after cleaning
    if (!cleanGroupName || !cleanColumnLabel) {
      console.warn('createFieldName: Empty result after normalization', { 
        originalGroup: groupName, 
        originalColumn: columnLabel,
        cleanGroup: cleanGroupName,
        cleanColumn: cleanColumnLabel,
      });
      return null;
    }
    
    // Use double underscore as delimiter to reduce collision risk
    // This makes "Primary Contact" + "Email" different from "Primary" + "Contact Email"
    return `${cleanGroupName}__${cleanColumnLabel}`;
  };

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
      // Keep the grouped structure for backward compatibility
      contact_groups: {},
    };
    
    // Transform custom_data using column mapping to create flattened fields
    if (memberData.custom_data) {
      Object.entries(memberData.custom_data).forEach(([groupId, groupData]) => {
        const normalizedGroupId = String(groupId);
        const groupInfo = contactGroups.find(g => g.group_id === normalizedGroupId);
        const groupName = groupInfo ? groupInfo.name : `Group ${normalizedGroupId}`;
        
        // Keep grouped structure for backward compatibility
        if (!transformedMember.contact_groups[groupName]) {
          transformedMember.contact_groups[groupName] = {};
        }
        
        Object.entries(groupData).forEach(([columnId, value]) => {
          const groupColumnId = `${normalizedGroupId}_${columnId}`;
          const columnInfo = columnMapping[groupColumnId];
          
          if (columnInfo && value && String(value).trim()) {
            const columnLabel = columnInfo.label;
            
            // Add to grouped structure (backward compatibility)
            transformedMember.contact_groups[groupName][columnLabel] = value;
            
            // Add as flattened field using group name + column label
            const flatFieldName = createFieldName(groupName, columnLabel);
            if (flatFieldName) {
              transformedMember[flatFieldName] = value;
            }
          } else if (value && String(value).trim()) {
            // Fallback for unmapped columns
            const fallbackLabel = `Column ${columnId}`;
            transformedMember.contact_groups[groupName][fallbackLabel] = value;
            
            // Add as flattened field with fallback name
            const flatFieldName = createFieldName(groupName, fallbackLabel);
            if (flatFieldName) {
              transformedMember[flatFieldName] = value;
            }
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
      // Metadata removed - no longer needed since fields are flattened onto member objects
    },
  };
};

module.exports = {
  transformMemberGridData,
};