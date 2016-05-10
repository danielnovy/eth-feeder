contract quote {

    mapping (bytes32 => uint32)  public quotes;
    mapping (bytes32 => address) public nameToFeeder;

    bytes32[] public quoteNames;

    // Anyone can feed any quote in here. Just make sure that the name you are
    // going to use for your feed is not taken.
    // Name should be very informative. For instance, Regis will use the name
    // ETHUSD_D_REGIS to represent the value of 1 ether in Dollars updated once a day.
    function setFeederFor(bytes32 name) {
        if (nameToFeeder[name] == 0) {
            nameToFeeder[name] = msg.sender;
            quoteNames.length++;
            quoteNames[quoteNames.length - 1] = name;
        }
    }
    
    function updateQuote(bytes32 name, uint32 price) {
        // Only owner of the 'name' can update its price
        if (nameToFeeder[name] == msg.sender) {
            quotes[name] = price;
        }
    }

    function transfer(bytes32 name, address newOwner) {
        if (nameToFeeder[name] == msg.sender) {
            nameToFeeder[name] = newOwner;
        }
    }
}
