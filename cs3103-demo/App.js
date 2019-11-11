import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

var httpBridge = require('react-native-http-bridge');

export default function App() {
  // initalize the server (now accessible via localhost:1234)
  httpBridge.start(5561, function(request) {

    // you can use request.url, request.type and request.postData here
    if (request.type === "GET" && request.url.split("/")[1] === "users") {
      httpBridge.respond(200, "application/json", "{\"message\": \"OK\"}");
    } else {
      httpBridge.respond(400, "application/json", "{\"message\": \"Bad Request\"}");
    }

  });

  return (
    <View style={styles.container}>
      <Text>Open up App.js to start working on your app!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
