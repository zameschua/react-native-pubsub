import React, { Component } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import PubSub from './temp/PubSub';

export default class App extends Component {
  componentDidMount() {
    PubSub.init()
        .then(() => {
          console.log('initing');
          PubSub.subscribe('food', data => console.log(data));
          PubSub.publish('food', {
            action: "ADD",
            item: {
              itemData: 'itemData',
            }
          })
        })
  }

  componentWillUnmount() {
    PubSub.stop();
  }

  render() {
    return (
        <View style={styles.container}>
          <Text>Open up App.js to start working on your app!</Text>
        </View>
    );
  }


}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
