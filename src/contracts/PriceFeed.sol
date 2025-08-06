// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title PriceFeed
 * @dev Oracle price feed contract for Hedera network
 * Stores and manages price data from multiple oracle sources
 */
contract PriceFeed {
    struct PriceData {
        uint256 price;
        uint256 timestamp;
        address oracle;
        bool isValid;
    }
    
    mapping(string => PriceData) public prices;
    mapping(address => bool) public authorizedOracles;
    mapping(string => address[]) public priceProviders;
    
    address public owner;
    uint256 public constant PRICE_VALIDITY_PERIOD = 3600; // 1 hour
    
    event PriceUpdated(
        string indexed symbol,
        uint256 price,
        uint256 timestamp,
        address oracle
    );
    
    event OracleAuthorized(address indexed oracle, bool authorized);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }
    
    modifier onlyAuthorizedOracle() {
        require(authorizedOracles[msg.sender], "Only authorized oracles can update prices");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        authorizedOracles[msg.sender] = true;
    }
    
    /**
     * @dev Update price for a given symbol
     * @param symbol The price symbol (e.g., "ETH", "BTC")
     * @param price The new price in wei
     */
    function updatePrice(string memory symbol, uint256 price) external onlyAuthorizedOracle {
        require(price > 0, "Price must be greater than zero");
        
        prices[symbol] = PriceData({
            price: price,
            timestamp: block.timestamp,
            oracle: msg.sender,
            isValid: true
        });
        
        // Track which oracles provide prices for this symbol
        bool isNewProvider = true;
        address[] storage providers = priceProviders[symbol];
        for (uint i = 0; i < providers.length; i++) {
            if (providers[i] == msg.sender) {
                isNewProvider = false;
                break;
            }
        }
        
        if (isNewProvider) {
            priceProviders[symbol].push(msg.sender);
        }
        
        emit PriceUpdated(symbol, price, block.timestamp, msg.sender);
    }
    
    /**
     * @dev Get latest price for a symbol
     * @param symbol The price symbol
     * @return price The latest price
     * @return timestamp When the price was last updated
     * @return isValid Whether the price is still valid
     */
    function getPrice(string memory symbol) 
        external 
        view 
        returns (uint256 price, uint256 timestamp, bool isValid) 
    {
        PriceData memory priceData = prices[symbol];
        bool valid = priceData.isValid && 
                    (block.timestamp - priceData.timestamp) <= PRICE_VALIDITY_PERIOD;
                    
        return (priceData.price, priceData.timestamp, valid);
    }
    
    /**
     * @dev Get all price providers for a symbol
     * @param symbol The price symbol
     * @return Array of oracle addresses providing prices for this symbol
     */
    function getPriceProviders(string memory symbol) 
        external 
        view 
        returns (address[] memory) 
    {
        return priceProviders[symbol];
    }
    
    /**
     * @dev Authorize or deauthorize an oracle
     * @param oracle The oracle address
     * @param authorized Whether to authorize or deauthorize
     */
    function setOracleAuthorization(address oracle, bool authorized) 
        external 
        onlyOwner 
    {
        authorizedOracles[oracle] = authorized;
        emit OracleAuthorized(oracle, authorized);
    }
    
    /**
     * @dev Check if a price is stale
     * @param symbol The price symbol
     * @return Whether the price is stale
     */
    function isPriceStale(string memory symbol) external view returns (bool) {
        PriceData memory priceData = prices[symbol];
        return (block.timestamp - priceData.timestamp) > PRICE_VALIDITY_PERIOD;
    }
    
    /**
     * @dev Emergency function to invalidate a price
     * @param symbol The price symbol to invalidate
     */
    function invalidatePrice(string memory symbol) external onlyOwner {
        prices[symbol].isValid = false;
    }
}