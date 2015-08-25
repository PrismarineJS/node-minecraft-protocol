module.exports = {
  getField: getField,
  getFieldInfo: getFieldInfo,
};

function getField(countField, rootNode) {
  var countFieldArr = countField.split(".");
  var count = rootNode;
  for(var index = 0; index < countFieldArr.length; index++) {
    count = count[countFieldArr[index]];
  }
  return count;
}

function getFieldInfo(fieldInfo) {
  if (typeof fieldInfo === "string")
    return { type: fieldInfo };
  else if (Array.isArray(fieldInfo))
    return { type: fieldInfo[0], typeArgs: fieldInfo[1] };
  else if (typeof fieldInfo.type === "string")
    return fieldInfo;
  else
    throw new Error("Not a fieldinfo");
}
