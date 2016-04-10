import states from "../states";

export default function(client, options) {
  client.once('success', onLogin);

  function onLogin(packet) {
    client.state = states.PLAY;
    client.uuid = packet.uuid;
    client.username = packet.username;
  }
};
