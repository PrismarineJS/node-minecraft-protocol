# node-minecraft-protocol proxy

A proxy, create a nmp server, if you connect to that server with a client, it creates a nmp client which connect to the server you initially provided.

## Usage

```
usage: node proxy.js [<options>...] <target_srv> <version>
options:
  --dump name
    print to stdout messages with the specified name.
  --dump-all
    print to stdout all messages, except those specified with -x.
  -x name
    do not print messages with this name.
  name
    a packet name as defined in protocol.json
examples:
  node proxy.js --dump-all -x keep_alive -x update_time -x entity_velocity -x rel_entity_move -x entity_look -x entity_move_look -x entity_teleport -x entity_head_rotation -x position localhost 1.8
    print all messages except for some of the most prolific.
  node examples/proxy.js --dump open_window --dump close_window --dump set_slot --dump window_items --dump craft_progress_bar --dump transaction --dump close_window --dump window_click --dump set_creative_slot --dump enchant_item localhost 1.8
    print messages relating to inventory management.
```
