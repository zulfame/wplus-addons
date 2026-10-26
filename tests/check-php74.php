<?php
/**
 * Does every PHP file of the plugin parse as PHP 7.4 (the version the plugin header promises)? Anything newer in the syntax is an
 * error, and so is a call to a function that only exists since PHP 8 (WordPress adds str_contains() and a few others for older PHP,
 * but they are listed here anyway to keep the code plain). Run it with the parser of nikic/php-parser:
 *
 *   composer require --working-dir=<a folder outside the plugin> nikic/php-parser
 *   PARSER_AUTOLOAD=<that folder>/vendor/autoload.php php tests/check-php74.php
 *
 * @package wplus-addons
 */

$autoload = getenv( 'PARSER_AUTOLOAD' );
if ( ! $autoload || ! is_readable( $autoload ) ) {
	fwrite( STDERR, "Set PARSER_AUTOLOAD to the vendor/autoload.php of nikic/php-parser.\n" );
	exit( 2 );
}
require $autoload;

use PhpParser\Node;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitorAbstract;
use PhpParser\ParserFactory;
use PhpParser\PhpVersion;

$root   = dirname( __DIR__ );
$parser = ( new ParserFactory() )->createForVersion( PhpVersion::fromString( '7.4' ) );
$php8   = array( 'str_contains', 'str_starts_with', 'str_ends_with', 'array_is_list', 'get_debug_type', 'get_resource_id', 'fdiv', 'preg_last_error_msg', 'enum_exists', 'json_validate', 'array_find', 'array_any', 'array_all', 'mb_str_pad' );
$files  = array();
foreach ( new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $root, FilesystemIterator::SKIP_DOTS ) ) as $file ) {
	$path = $file->getPathname();
	if ( 'php' === $file->getExtension() && ! preg_match( '#/(dist|tests|node_modules|vendor|\.git)/#', $path ) ) {
		$files[] = $path;
	}
}
sort( $files );
$bad = 0;
foreach ( $files as $file ) {
	try {
		$ast = $parser->parse( file_get_contents( $file ) );
	} catch ( PhpParser\Error $e ) {
		echo 'SYNTAX NOT IN 7.4: ' . substr( $file, strlen( $root ) + 1 ) . ': ' . $e->getMessage() . "\n";
		++$bad;
		continue;
	}
	$visitor = new class( $php8 ) extends NodeVisitorAbstract {
		/** @var string[] */
		public $found = array();
		/** @var string[] */
		private $names;

		public function __construct( $names ) {
			$this->names = $names;
		}

		public function enterNode( Node $node ) {
			if ( $node instanceof Node\Expr\FuncCall && $node->name instanceof Node\Name && in_array( strtolower( $node->name->toString() ), $this->names, true ) ) {
				$this->found[] = $node->name->toString() . '() on line ' . $node->getStartLine();
			}
			return null;
		}
	};
	$traverser = new NodeTraverser();
	$traverser->addVisitor( $visitor );
	$traverser->traverse( $ast );
	foreach ( $visitor->found as $found ) {
		echo 'PHP 8 FUNCTION: ' . substr( $file, strlen( $root ) + 1 ) . ': ' . $found . "\n";
		++$bad;
	}
}
echo count( $files ) . " files, $bad problem(s)\n";
exit( $bad ? 1 : 0 );
