module.exports=mcHexDigest;

function mcHexDigest(hash) {
  var buffer = new Buffer(hash.digest(), 'binary');
  // check for negative hashes
  var negative = buffer.readInt8(0) < 0;
  if(negative)
    performTwosCompliment(buffer);
  var digest = buffer.toString('hex');
  // trim leading zeroes
  digest = digest.replace(/^0+/g, '');
  if(negative)
    digest = '-' + digest;
  return digest;

  function performTwosCompliment(buffer) {
    var carry = true;
    var i, newByte, value;
    for(i = buffer.length - 1; i >= 0; --i) {
      value = buffer.readUInt8(i);
      newByte = ~value & 0xff;
      if(carry) {
        carry = newByte === 0xff;
        buffer.writeUInt8((newByte + 1) & 0xff, i);
      } else {
        buffer.writeUInt8(newByte, i);
      }
    }
  }
}
