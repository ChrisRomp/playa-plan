type DataType = 'STRING' | 'MULTILINE_STRING' | 'INTEGER' | 'NUMBER' | 'BOOLEAN' | 'DATE';

/**
 * Maps data type enum values to user-friendly display names
 */
export const getDataTypeFriendlyName = (dataType: DataType): string => {
  const mappings: Record<DataType, string> = {
    STRING: 'Text',
    MULTILINE_STRING: 'Multiline Text',
    NUMBER: 'Number',
    INTEGER: 'Integer',
    DATE: 'Date',
    BOOLEAN: 'Yes/No'
  };

  return mappings[dataType] || dataType;
};