module.exports = {
  getField: getField,
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
