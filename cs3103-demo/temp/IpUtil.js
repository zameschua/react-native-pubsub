/**
 * Helper methods to deal with IP calculations because I couldn't get the module to work with React Native
 * Borrowed from https://github.com/indutny/node-ip
 * @private
 */

var Buffer = require('buffer').Buffer;

const IpUtil = {
    toLong(ip) {
        var ipl = 0;
        ip.split('.').forEach(function(octet) {
            ipl <<= 8;
            ipl += parseInt(octet);
        });
        return(ipl >>> 0);
    },

    fromLong(ipl) {
        return ((ipl >>> 24) + '.' +
            (ipl >> 16 & 255) + '.' +
            (ipl >> 8 & 255) + '.' +
            (ipl & 255) );
    },

    calculateSubnetInfo(addr, mask) {
        var networkAddress = this.toLong(this.mask(addr, mask));

        // Calculate the mask's length.
        var maskBuffer = this.toBuffer(mask);
        var maskLength = 0;

        for (var i = 0; i < maskBuffer.length; i++) {
            if (maskBuffer[i] === 0xff) {
                maskLength += 8;
            } else {
                var octet = maskBuffer[i] & 0xff;
                while (octet) {
                    octet = (octet << 1) & 0xff;
                    maskLength++;
                }
            }
        }

        var numberOfAddresses = Math.pow(2, 32 - maskLength);

        return {
            networkAddress: this.fromLong(networkAddress),
            firstAddress: numberOfAddresses <= 2 ?
                this.fromLong(networkAddress) :
                this.fromLong(networkAddress + 1),
            lastAddress: numberOfAddresses <= 2 ?
                this.fromLong(networkAddress + numberOfAddresses - 1) :
                this.fromLong(networkAddress + numberOfAddresses - 2),
            broadcastAddress: this.fromLong(networkAddress + numberOfAddresses - 1),
            subnetMask: mask,
            subnetMaskLength: maskLength,
            numHosts: numberOfAddresses <= 2 ?
                numberOfAddresses : numberOfAddresses - 2,
            length: numberOfAddresses,
            contains: function (other) {
                return networkAddress === this.toLong(this.mask(other, mask));
            }
        };
    },

    mask(addr, mask) {
        addr = this.toBuffer(addr);
        mask = this.toBuffer(mask);

        var result = new Buffer(Math.max(addr.length, mask.length));

        var i = 0;
        // Same protocol - do bitwise and
        if (addr.length === mask.length) {
            for (i = 0; i < addr.length; i++) {
                result[i] = addr[i] & mask[i];
            }
        } else if (mask.length === 4) {
            // IPv6 address and IPv4 mask
            // (Mask low bits)
            for (i = 0; i < mask.length; i++) {
                result[i] = addr[addr.length - 4  + i] & mask[i];
            }
        } else {
            // IPv6 mask and IPv4 addr
            for (var i = 0; i < result.length - 6; i++) {
                result[i] = 0;
            }

            // ::ffff:ipv4
            result[10] = 0xff;
            result[11] = 0xff;
            for (i = 0; i < addr.length; i++) {
                result[i + 12] = addr[i] & mask[i + 12];
            }
            i = i + 12;
        }
        for (; i < result.length; i++)
            result[i] = 0;

        return this.toString(result);
    },

    toBuffer(ip, buff, offset) {
        offset = ~~offset;

        var result;

        if (this.isV4Format(ip)) {
            result = buff || new Buffer(offset + 4);
            ip.split(/\./g).map(function(byte) {
                result[offset++] = parseInt(byte, 10) & 0xff;
            });
        } else if (this.isV6Format(ip)) {
            var sections = ip.split(':', 8);

            var i;
            for (i = 0; i < sections.length; i++) {
                var isv4 = this.isV4Format(sections[i]);
                var v4Buffer;

                if (isv4) {
                    v4Buffer = this.toBuffer(sections[i]);
                    sections[i] = v4Buffer.slice(0, 2).toString('hex');
                }

                if (v4Buffer && ++i < 8) {
                    sections.splice(i, 0, v4Buffer.slice(2, 4).toString('hex'));
                }
            }

            if (sections[0] === '') {
                while (sections.length < 8) sections.unshift('0');
            } else if (sections[sections.length - 1] === '') {
                while (sections.length < 8) sections.push('0');
            } else if (sections.length < 8) {
                for (i = 0; i < sections.length && sections[i] !== ''; i++);
                var argv = [ i, 1 ];
                for (i = 9 - sections.length; i > 0; i--) {
                    argv.push('0');
                }
                sections.splice.apply(sections, argv);
            }

            result = buff || new Buffer(offset + 16);
            for (i = 0; i < sections.length; i++) {
                var word = parseInt(sections[i], 16);
                result[offset++] = (word >> 8) & 0xff;
                result[offset++] = word & 0xff;
            }
        }

        if (!result) {
            throw Error('Invalid ip address: ' + ip);
        }

        return result;
    },

    toString(buff, offset, length) {
        offset = ~~offset;
        length = length || (buff.length - offset);

        var result = [];
        if (length === 4) {
            // IPv4
            for (var i = 0; i < length; i++) {
                result.push(buff[offset + i]);
            }
            result = result.join('.');
        } else if (length === 16) {
            // IPv6
            for (var i = 0; i < length; i += 2) {
                result.push(buff.readUInt16BE(offset + i).toString(16));
            }
            result = result.join(':');
            result = result.replace(/(^|:)0(:0)*:0(:|$)/, '$1::$3');
            result = result.replace(/:{3,4}/, '::');
        }

        return result;
    },

    IPV4_REGEX: /^(\d{1,3}\.){3,3}\d{1,3}$/,

    IPV6_REGEX: /^(::)?(((\d{1,3}\.){3}(\d{1,3}){1})?([0-9a-f]){0,4}:{0,2}){1,8}(::)?$/i,

    isV4Format(ip) {
        return this.IPV4_REGEX.test(ip);
    },

    isV6Format(ip) {
        return this.IPV6_REGEX.test(ip);
    },

};

export default IpUtil;
