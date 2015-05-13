module.exports= {getField:getField};

function getField(countField, rootNode) {
    var countFieldArr = countField.split(".");
    var count = rootNode;
    for (var index = 0; index < countFieldArr.length; index++) {
        count = count[countFieldArr[index]];
    }
    return count;
}
