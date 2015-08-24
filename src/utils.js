module.exports = {
  getField: getField,
  getFieldInfo: getFieldInfo,
  evalCondition: evalCondition
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

function evalCondition(condition, field_values) {
  var field_value_to_test = "this" in condition && condition["this"] ? field_values["this"][condition.field] : field_values[condition.field];
  var b = condition.values.some(function(value) {
    return field_value_to_test === value;
  });
  if("different" in condition && condition["different"])
    return !b;
  else
    return b;
}
