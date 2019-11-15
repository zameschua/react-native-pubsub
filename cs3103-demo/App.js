import React, { Component } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TouchableHighlight, SafeAreaView, Image, FlatList } from 'react-native';

import PubSub from './temp/PubSub';

export default class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            peers: {},
            device: 'cashier',
            items: [
                {
                    name: 'Coffee',
                    image: require('./assets/coffee.jpg'),
                    price: '$1.50',
                },
                {
                    name: 'Tea',
                    image: require('./assets/tea.jpg'),
                    price: '$1.30'
                },
                {
                    name: 'Eggs',
                    image: require('./assets/eggs.jpg'),
                    price: '$2.00'
                },
                {
                    name: 'Toast',
                    image: require('./assets/toast.jpg'),
                    price: '$1.00'
                },
                {
                    name: 'Prata',
                    image: require('./assets/prata.jpg'),
                    price: '$0.80'
                },
            ],
            orders: [],
        };
    }

    handleInit = () => {
        PubSub.registerPeerJoinedListener(() => {
            console.log('Registering peer joined!');
            this.setState({
                peers: PubSub.getPeers(),
            });
        });
        PubSub.init();
    }

    handleSubscribe = () => {
        PubSub.subscribe('kitchen', data => this.setState({
            orders: data,
        }));
    }

    componentWillUnmount = () => {
        PubSub.stop();
    }

    addItem = (item) => {
        this.setState({
            orders: [...this.state.orders, {
                ...item,
                id: Math.random() + '', // Random id
            }],
        });
    }

  removeItem = (itemToRemove) => {
      this.setState({
          orders: this.state.orders.filter(item => item !== itemToRemove),
      });
  }

  checkout = () => {
    PubSub.publish('kitchen', this.state.orders);
    this.setState({orders: []});
  }

  render() {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.tabs}>
                <TouchableOpacity style={styles.tab} onPress={() => this.setState({device: 'cashier'})}>
                    <Text style={{fontWeight: this.state.device === 'cashier' ? "600" : "300"}}>Cashier</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tab} onPress={() => this.setState({device: 'kitchen'})}>
                    <Text style={{fontWeight: this.state.device === 'kitchen' ? "600" : "300"}}>Kitchen</Text>
                </TouchableOpacity>
            </View>


            <View style={{padding: 10}}>
                <View style={{margin: 2}}>
                    {Object.keys(this.state.peers).length === 0 ? (
                        <View>
                            <TouchableOpacity onPress={this.handleInit} style={{height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', borderRadius: 5, borderWidth: 1, borderColor: '#49a4d5', borderStyle: 'solid'}}>
                                <Text style={{color: '#49a4d5'}}>Init server</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View>
                            <Text>Connected peers:</Text>
                            {Object.keys(this.state.peers).map((ipAddress, index) => {
                                return <Text>{ipAddress} : {this.state.peers[ipAddress] ? 'connected' : 'disconnected'}</Text>
                            })}
                        </View>
                    )}
                </View>

                <View style={{margin: 2}}>
                    <TouchableOpacity onPress={this.handleSubscribe} style={{height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', borderRadius: 5, borderWidth: 1, borderColor: '#49a4d5', borderStyle: 'solid'}}>
                        <Text style={{color: '#49a4d5'}}>Subscribe</Text>
                    </TouchableOpacity>
                </View>
            </View>
            {this.state.device === 'cashier' ? (
                <View style={{flex: 1, padding: 10}}>
                    <Text style={{fontSize: 30, fontWeight: 'bold', margin: 5}}>Cashier</Text>
                    <View style={{display: 'flex', flex: 1, flexDirection: 'row', justifyContent: 'space-between'}}>
                        {this.state.items.map((item) => (
                            <TouchableOpacity key={Math.random() + ''} style={{flex: 1, margin: 5}} onPress={() => this.addItem(item)}>
                                <View>
                                    <Image source={item.image} resizeMode='cover' style={{width: '100%', height: 100, borderRadius: 5,}}/>
                                    <Text style={{marginTop: 10, fontWeight: '500'}}>{item.name}</Text>
                                    <Text style={{marginTop: 5,}}>{item.price}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={{flex: 1}}>
                        <Text style={{margin: 10, fontSize: 30, fontWeight: 'bold'}}>Orders</Text>
                        <View style={{flex: 1, padding: 10,}}>
                            <FlatList
                                data={this.state.orders}
                                renderItem={({ item }) => (
                                    <View style={{height: 40, width: '100%', flexDirection: 'row', justifyContent: 'space-between'}}>
                                        <Text style={{marginTop: 10, fontWeight: '500'}}>{item.name}</Text>
                                        <Text style={{marginTop: 5,}}>{item.price}</Text>
                                    </View>
                                )}
                                keyExtractor={item => item.id}
                            />
                        </View>
                        <TouchableOpacity onPress={() => this.checkout()} style={{height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: '#49a4d5', borderRadius: 5,}}>
                            <Text style={{fontWeight: '600', color: 'white',}}>CHECKOUT</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <View style={{flex: 1}}>
                    <Text style={{margin: 10, fontSize: 30, fontWeight: 'bold'}}>Orders</Text>
                    <View style={{flex: 1, padding: 10,}}>
                        <FlatList
                            data={this.state.orders}
                            renderItem={({ item }) => (
                                <View style={{height: 40, width: '100%', flexDirection: 'row', justifyContent: 'space-between'}}>
                                    <Text style={{marginTop: 10, fontWeight: '500'}}>{item.name}</Text>
                                    <TouchableOpacity style={{marginTop: 5,}} onPress={() => this.removeItem(item)}>
                                        <Text style={{color: "#49a4d5"}}>Done</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            keyExtractor={item => Math.random() + ''}
                        />
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
  }


}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        justifyContent: 'space-between',
    },
    tabs: {
        display: 'flex',
        flexDirection: 'row',
        height: 50,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    }
});
